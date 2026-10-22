package com.lingbuilder.companion

import android.hardware.usb.UsbAccessory
import android.hardware.usb.UsbManager
import android.os.ParcelFileDescriptor
import java.io.FileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.concurrent.thread

/**
 * AOAv2 USB 数据通道（二期）：伴生应用经 UsbManager.openAccessory 拿到 bulk 端点 fd，
 * 与电脑侧 AOA_打开数据通道 对接。
 *
 * LBAC 帧格式（与模块一字不差）：4B magic "LBAC" + 2B 通道 ID 小端 + 4B 载荷长度小端 + 载荷。
 * 约定：通道 1 = 视频 JPEG（手机 → 电脑），通道 2 = 控制/事件 JSON（电脑 → 手机）。
 *
 * 优先级红线：USB 数据通道活跃时，上层应停用 WebSocket 推流（USB 优先）。
 */
class UsbDataChannel(
    private val usbManager: UsbManager,
    private val onControlJson: (String) -> Unit,
    private val onDetached: () -> Unit,
) {
    companion object {
        const val CHANNEL_VIDEO = 1
        const val CHANNEL_CONTROL = 2
        private const val MAX_PAYLOAD = 16 * 1024 * 1024
    }

    @Volatile var accessory: UsbAccessory? = null
        private set
    private var fileDescriptor: ParcelFileDescriptor? = null
    private var inputStream: FileInputStream? = null
    private var outputStream: FileOutputStream? = null
    private val running = AtomicBoolean(false)
    val sentFrames = AtomicLong(0)
    val sentBytes = AtomicLong(0)
    val receivedFrames = AtomicLong(0)
    @Volatile var lastError = ""
        private set

    val isActive: Boolean get() = running.get()

    /** 尝试打开配件数据通道；成功返回真。 */
    @Synchronized
    fun open(target: UsbAccessory): Boolean {
        if (running.get()) return true
        return try {
            val fd = usbManager.openAccessory(target)
            AppLog.d("USB-fd", "openAccessory → " + (fd != null))
            if (fd == null) {
                lastError = "openAccessory 返回空（配件权限未授予或已被占用）"
                return false
            }
            accessory = target
            fileDescriptor = fd
            inputStream = FileInputStream(fd.fileDescriptor)
            outputStream = FileOutputStream(fd.fileDescriptor)
            running.set(true)
            // 电脑 → 手机：控制 JSON 读循环（通道 2）
            AppLog.d("USB-fd", "fd 已打开，读循环启动")
            thread(name = "usb-control-reader") { controlReaderLoop() }
            true
        } catch (e: Exception) {
            lastError = "打开配件数据通道失败：" + (e.message ?: e.javaClass.simpleName)
            AppLog.d("USB-fd", "open 异常：" + lastError)
            closeInternal()
            false
        }
    }

    @Synchronized
    fun close() {
        if (!running.get()) return
        running.set(false)
        closeInternal()
    }

    private fun closeInternal() {
        try { inputStream?.close() } catch (_: IOException) {}
        try { outputStream?.close() } catch (_: IOException) {}
        try { fileDescriptor?.close() } catch (_: Exception) {}
        inputStream = null
        outputStream = null
        fileDescriptor = null
        accessory = null
    }

    /** 投喂一帧视频（JPEG 载荷），内部打包 LBAC 通道 1。阻塞写；USB 断开返回假。 */
    fun sendVideoFrame(jpeg: ByteArray): Boolean {
        if (!running.get()) return false
        val out = outputStream ?: return false
        return try {
            writeFrame(out, CHANNEL_VIDEO, jpeg)
            sentFrames.incrementAndGet()
            sentBytes.addAndGet(jpeg.size.toLong())
            true
        } catch (e: IOException) {
            lastError = "USB 写帧失败：" + (e.message ?: "IO")
            stopByError()
            false
        }
    }

    /** 投喂一条控制/事件 JSON（LBAC 通道 2），PC 侧 AOA_数据通道收帧 会收到。 */
    fun sendControlJson(json: String): Boolean {
        if (!running.get()) {
            AppLog.d("USB写", "sendControlJson 跳过：通道未运行")
            return false
        }
        val out = outputStream ?: return false
        return try {
            writeFrame(out, CHANNEL_CONTROL, json.toByteArray(Charsets.UTF_8))
            AppLog.d("USB写", "已发控制帧 " + json.take(80))
            true
        } catch (e: IOException) {
            lastError = "USB 写控制帧失败：" + (e.message ?: "IO")
            AppLog.d("USB写", "写失败：" + lastError)
            stopByError()
            false
        }
    }

    private fun controlReaderLoop() {
        val input = inputStream ?: return
        AppLog.d("USB读循环", "启动（滚动缓冲状态机 v1.2.4），等待 PC 帧")
        val magic = byteArrayOf('L'.code.toByte(), 'B'.code.toByte(), 'A'.code.toByte(), 'C'.code.toByte())
        var acc = ByteArray(0)
        val chunk = ByteArray(4096)
        while (running.get()) {
            val n = try { input.read(chunk) } catch (e: IOException) {
                AppLog.d("USB读循环", "IO 异常退出：" + (e.message ?: "IO"))
                break
            }
            if (n < 0) { AppLog.d("USB读循环", "流结束"); break }
            if (n > 0) acc = acc + chunk.copyOfRange(0, n)

            // 贪心解析：无论头/载荷是否被重排，只要魔数+载荷形态（通道 2 必须形如 JSON）成立就派发，
            // 否则滑动 1 字节重找（真机实锤：MTP 直通会话的字节流呈现 [头][头][载荷] 重排形态）。
            var head = 0
            var progressed = true
            while (progressed) {
                progressed = false
                // 1) 对齐到下一个魔数
                var idx = -1
                var i = head
                while (i + 4 <= acc.size) {
                    if (acc[i] == magic[0] && acc[i + 1] == magic[1] && acc[i + 2] == magic[2] && acc[i + 3] == magic[3]) { idx = i; break }
                    i++
                }
                if (idx < 0) {
                    // 无完整魔数：保留末尾 3 字节（防魔数跨块），丢弃其余
                    if (acc.size - head > 3) { acc = acc.copyOfRange(acc.size - 3, acc.size); }
                    head = 0
                    break
                }
                head = idx
                if (acc.size - head < 10) break // 头不完整，等更多数据
                val chId = (acc[head + 4].toInt() and 0xFF) or ((acc[head + 5].toInt() and 0xFF) shl 8)
                val len = ((acc[head + 6].toInt() and 0xFF)) or
                    ((acc[head + 7].toInt() and 0xFF) shl 8) or
                    ((acc[head + 8].toInt() and 0xFF) shl 16) or
                    ((acc[head + 9].toInt() and 0xFF) shl 24)
                if (len < 0 || len > MAX_PAYLOAD) { AppLog.d("USB读循环", "坏长度 len=" + len + "，滑动"); head += 1; progressed = true; continue }
                if (acc.size - head - 10 < len) break // 载荷未收全，等更多数据
                val payload = acc.copyOfRange(head + 10, head + 10 + len)
                val text = String(payload, Charsets.UTF_8)
                val looksJson = len == 0 || text.startsWith("{") || text.startsWith(" ")
                if (chId == CHANNEL_CONTROL && !looksJson) {
                    // 假帧（载荷形态不对＝这是被重排嵌入的另一个头），滑动 1 字节重找
                    AppLog.d("USB读循环", "假帧（载荷非 JSON）@" + head + "，滑动重找")
                    head += 1
                    progressed = true
                    continue
                }
                // 真帧：消费
                receivedFrames.incrementAndGet()
                if (chId == CHANNEL_CONTROL) {
                    AppLog.d("USB读循环", "收到控制帧 #" + receivedFrames.get() + " len=" + len + " " + text.take(80))
                    if (text.isNotBlank()) onControlJson(text)
                } else {
                    AppLog.d("USB读循环", "收到数据帧 ch=" + chId + " len=" + len + "（忽略）")
                }
                head = head + 10 + len
                progressed = true
            }
            if (head > 0 && head <= acc.size) acc = acc.copyOfRange(minOf(head, acc.size), acc.size)
            if (acc.size > (1 shl 20)) { AppLog.d("USB读循环", "缓冲超限丢弃"); acc = ByteArray(0) }
        }
        AppLog.d("USB读循环", "退出（running=" + running.get() + " 共收 " + receivedFrames.get() + " 帧 lastError=" + lastError + "）")
        if (running.get()) stopByError()
    }

    private fun stopByError() {
        if (running.compareAndSet(true, false)) {
            onDetached()
        }
    }

    private fun writeFrame(out: FileOutputStream, channel: Int, payload: ByteArray) {
        val header = ByteArray(10)
        header[0] = 'L'.code.toByte(); header[1] = 'B'.code.toByte()
        header[2] = 'A'.code.toByte(); header[3] = 'C'.code.toByte()
        header[4] = (channel and 0xff).toByte()
        header[5] = ((channel shr 8) and 0xff).toByte()
        val n = payload.size
        header[6] = (n and 0xff).toByte()
        header[7] = ((n shr 8) and 0xff).toByte()
        header[8] = ((n shr 16) and 0xff).toByte()
        header[9] = ((n shr 24) and 0xff).toByte()
        out.write(header)
        if (payload.isNotEmpty()) out.write(payload)
        out.flush()
    }

    private fun readFully(input: FileInputStream, buffer: ByteArray, count: Int): Boolean {
        var offset = 0
        while (offset < count) {
            val n = input.read(buffer, offset, count - offset)
            if (n < 0) return false
            offset += n
        }
        return true
    }
}

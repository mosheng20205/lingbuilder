package com.lingbuilder.companion

import android.os.Build
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import kotlin.concurrent.thread

/**
 * 投屏自动发现信标（v1.3.1）：投屏会话运行期间每 3 秒向局域网广播本机连接串，
 * PC 端 MirrorDesk 查看器监听 UDP 51750 后自动分配槽位并连接，免除人工抄写 ws 地址。
 *
 * - 双发防 AP 隔离：255.255.255.255 受限广播 + 按本机 IPv4 推导的 /24 定向广播。
 * - 停止投屏先发 {"offline":1} 数字形态下线包（PC 端 JSON_取整数 认数字；也兼容布尔 true）
 *   再关套接字；进程被系统杀死时无下线包，由 PC 端心跳超时兜底释放槽位。
 * - v1.3.1：广播循环从 Handler.postDelayed 自链改为单工作线程 while+sleep——Handler 链
 *   在个别 ROM 上会静默断链（信标停发而投屏会话仍活着，PC 侧从此再也看不到该设备）。
 * - 信标明文含配对码，与主界面 openly 展示配对码同一威胁模型，仅限可信局域网使用。
 */
class BeaconBroadcaster(
    private val wsUrlProvider: () -> String,
    private val frameSizeProvider: () -> IntArray,
    private val fpsProvider: () -> Int,
    private val serialProvider: () -> String,
) {
    companion object {
        /** PC 端查看器固定监听的发现端口（src/aoa-viewer 功能/群控库.lcpp 信标启动 同值）。 */
        const val PORT = 51750
        const val INTERVAL_MS = 3000L
        private const val APP_ID = "lingbuilder-companion"
        private const val VER = 131

        /** 本机局域网 IPv4（站点本地地址），没有返回 null（无 Wi-Fi/仅流量时不广播）。 */
        fun localIpv4(): Inet4Address? {
            return try {
                val interfaces = NetworkInterface.getNetworkInterfaces()
                while (interfaces.hasMoreElements()) {
                    val nif = interfaces.nextElement()
                    if (!nif.isUp || nif.isLoopback) continue
                    val addresses = nif.inetAddresses
                    while (addresses.hasMoreElements()) {
                        val address = addresses.nextElement()
                        if (address is Inet4Address && address.isSiteLocalAddress) return address
                    }
                }
                null
            } catch (_: Exception) {
                null
            }
        }
    }

    private var worker: Thread? = null
    private var socket: DatagramSocket? = null

    @Volatile private var running = false

    fun start() {
        if (running) return
        running = true
        worker = thread(name = "beacon-broadcast", isDaemon = true) {
            while (running) {
                sendBeacon(offline = false)
                var slept = 0L
                while (running && slept < INTERVAL_MS) {
                    try {
                        Thread.sleep(150)
                    } catch (_: InterruptedException) {
                        return@thread
                    }
                    slept += 150
                }
            }
        }
    }

    /** 停止广播并尽力发一包下线信标（网络瞬断时静默失败，PC 端有心跳超时兜底）。 */
    fun stop() {
        if (!running) return
        running = false
        worker?.interrupt()
        worker = null
        thread(name = "beacon-offline", isDaemon = true) {
            sendBeacon(offline = true)
            socket?.close()
            socket = null
        }
    }

    private fun sendBeacon(offline: Boolean) {
        val wsUrl = try { wsUrlProvider() } catch (_: Exception) { "" }
        if (wsUrl.isEmpty()) return
        val payload = if (offline) {
            "{\"app\":\"$APP_ID\",\"offline\":1,\"ws\":\"$wsUrl\"}"
        } else {
            val size = try { frameSizeProvider() } catch (_: Exception) { intArrayOf(0, 0) }
            val fps = try { fpsProvider() } catch (_: Exception) { 0 }
            // sn=本机配件序列号（PC 端识别串第 5 段下发的手机真实 SN，配件模式才可读）：
            // PC 端据此把 Wi-Fi 视频槽与 USB HID 槽自动对齐；非配件模式为空串，PC 跳过对齐。
            val sn = try { serialProvider() } catch (_: Exception) { "" }
            "{\"app\":\"$APP_ID\",\"ver\":$VER,\"name\":\"${Build.MODEL}\"," +
                "\"ws\":\"$wsUrl\",\"w\":${size.getOrElse(0) { 0 }},\"h\":${size.getOrElse(1) { 0 }},\"fps\":$fps,\"sn\":\"$sn\"}"
        }
        val data = payload.toByteArray(Charsets.UTF_8)
        val targets = broadcastTargets()
        if (targets.isEmpty()) return
        try {
            val sock = socket ?: DatagramSocket().also { it.broadcast = true; socket = it }
            for (address in targets) {
                try {
                    sock.send(DatagramPacket(data, data.size, address, PORT))
                } catch (_: Exception) {
                }
            }
        } catch (_: Exception) {
            AppLog.d("信标", "发送失败（网络未就绪，下轮重试）")
        }
    }

    /** 255.255.255.255 受限广播 + 本机 IPv4 所在 /24 的定向广播（双发防 AP 隔离）。 */
    private fun broadcastTargets(): List<InetAddress> {
        val targets = ArrayList<InetAddress>(2)
        val local = localIpv4()
        val prefix = local?.hostAddress?.substringBeforeLast('.')
        if (local != null && !prefix.isNullOrEmpty() && prefix.contains('.')) {
            try { targets.add(InetAddress.getByName("$prefix.255")) } catch (_: Exception) {}
        }
        try { targets.add(InetAddress.getByName("255.255.255.255")) } catch (_: Exception) {}
        return targets
    }
}

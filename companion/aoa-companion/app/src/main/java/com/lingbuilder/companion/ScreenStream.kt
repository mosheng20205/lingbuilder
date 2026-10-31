package com.lingbuilder.companion

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.HandlerThread
import android.util.DisplayMetrics
import android.view.Display
import android.view.Surface
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread

/**
 * 屏幕采集与 JPEG 编码：MediaProjection → 虚拟屏（按缩放档位直接低分辨率渲染）→ ImageReader
 * → RGBA → Bitmap → JPEG。旋转时重建虚拟屏，保证推流画面始终与当前屏幕方向一致（不拉伸错向）。
 */
class ScreenStream(
    private val context: Context,
    private val projection: MediaProjection,
    private val onFrame: (ByteArray) -> Unit,
    private val onScreenChanged: () -> Unit = {},
) {
    companion object {
        const val MIN_INTERVAL_MS = 66L   // 约 15fps 上限
        const val MAX_INTERVAL_MS = 100L  // 约 10fps 下限（自适应降帧地板）
    }

    private val mainHandler = Handler(context.mainLooper)
    /** 1.4.7：最近一帧 JPEG 缓存（screenshot 按需截图指令的数据源；控制模式不推流时也持续刷新）。 */
    @Volatile
    var lastJpeg: ByteArray? = null
        private set
    private var workerThread: HandlerThread? = null
    private var workerHandler: Handler? = null
    private var projectionCallback: MediaProjection.Callback? = null
    private var displayListener: DisplayManager.DisplayListener? = null

    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    private val metrics: DisplayMetrics = DisplayMetrics()
    private var rotation: Int = 0

    @Volatile var scale = 0.5f
    @Volatile var quality = 70
    @Volatile var intervalMs = 80L

    val frameWidth = AtomicInteger(0)
    val frameHeight = AtomicInteger(0)
    val sentFrames = AtomicLong(0)
    val droppedFrames = AtomicLong(0)
    val actualFps = AtomicInteger(0)
    private val lastSentAt = AtomicLong(0)
    private val fpsWindowCount = AtomicInteger(0)
    private val fpsWindowStart = AtomicLong(0)
    private val busy = AtomicBoolean(false)
    private var stopped = false
    private val recreateLock = ReentrantLock()

    fun start() {
        val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val display = displayManager.getDisplay(Display.DEFAULT_DISPLAY)
        display.getRealMetrics(metrics)
        rotation = display.rotation

        workerThread = HandlerThread("screen-stream").also { it.start() }
        workerHandler = Handler(workerThread!!.looper)

        projectionCallback = object : MediaProjection.Callback() {
            override fun onStop() {
                // 用户从系统面板停止投屏
                synchronized(this@ScreenStream) { stopped = true }
            }
        }
        projection.registerCallback(projectionCallback!!, workerHandler)

        displayListener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {
                if (displayId != Display.DEFAULT_DISPLAY) return
                val current = displayManager.getDisplay(Display.DEFAULT_DISPLAY)
                if (current.rotation != rotation) {
                    recreateSurface(current)
                }
            }
        }
        displayManager.registerDisplayListener(displayListener, mainHandler)

        createSurface(rotation)
    }

    fun stop() {
        synchronized(this) { stopped = true }
        try {
            (context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager)
                .unregisterDisplayListener(displayListener)
        } catch (_: Exception) {}
        try {
            projectionCallback?.let { projection.unregisterCallback(it) }
        } catch (_: Exception) {}
        releaseSurface()
        try { projection.stop() } catch (_: Exception) {}
        workerHandler?.removeCallbacksAndMessages(null)
        try { workerThread?.quitSafely() } catch (_: Exception) {}
    }

    fun isStopped(): Boolean = synchronized(this) { stopped }

    /** 旋转或缩放变化时重建虚拟屏与读取器。 */
    @Synchronized
    private fun recreateSurface(display: Display) {
        recreateLock.lock()
        try {
            rotation = display.rotation
            display.getRealMetrics(metrics)
            releaseSurface()
            createSurface(rotation)
            // v1.4.0：重建完成即广播 screenChanged，客户端刷新坐标换算缓存（纯通知，不携带句柄）
            onScreenChanged()
        } finally {
            recreateLock.unlock()
        }
    }

    /** v1.4.0 坐标回映射快照（queryScreen 纯读消费，不触发重建）：
     *  getRealMetrics 已按当前旋转返回宽高，与推流帧同方向，客户端可直接算 realWidth/frameWidth 比例。 */
    @Synchronized fun realWidth(): Int = metrics.widthPixels
    @Synchronized fun realHeight(): Int = metrics.heightPixels

    /** 当前旋转角度（0/90/180/270，与 EnvMonitor 心跳 rotation 同口径）。 */
    @Synchronized fun orientationDegrees(): Int = when (rotation) {
        Surface.ROTATION_90 -> 90
        Surface.ROTATION_180 -> 180
        Surface.ROTATION_270 -> 270
        else -> 0
    }

    fun applyScale(newScale: Float) {
        scale = newScale.coerceIn(0.25f, 1.0f)
        val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        recreateSurface(displayManager.getDisplay(Display.DEFAULT_DISPLAY))
    }

    @SuppressLint("WrongConstant")
    private fun createSurface(targetRotation: Int) {
        // getRealMetrics 已按当前旋转返回宽高（横屏时 width>height），这里不再自行交换，
        // 否则横屏会二次换向、画面被信箱式压扁
        val srcW = metrics.widthPixels
        val srcH = metrics.heightPixels
        val outW = maxOf(1, (srcW * scale).toInt())
        val outH = maxOf(1, (srcH * scale).toInt())
        frameWidth.set(outW)
        frameHeight.set(outH)

        val reader = ImageReader.newInstance(outW, outH, PixelFormat.RGBA_8888, 2)
        reader.setOnImageAvailableListener({ readerInternal ->
            // 非阻塞节流：仅当距上一帧超过 intervalMs 才消费，其余立即丢弃（Image 有界池，必须关闭）
            val now = android.os.SystemClock.uptimeMillis()
            val image: Image? = try { readerInternal.acquireLatestImage() } catch (e: Exception) { null }
            if (image == null) return@setOnImageAvailableListener
            if (busy.get() || now - lastSentAt.get() < intervalMs) {
                droppedFrames.incrementAndGet()
                image.close()
                return@setOnImageAvailableListener
            }
            busy.set(true)
            lastSentAt.set(now)
            thread(name = "frame-encode") {
                try {
                    encodeAndDispatch(image)
                } finally {
                    image.close()
                    busy.set(false)
                }
            }
        }, workerHandler)

        virtualDisplay = projection.createVirtualDisplay(
            "LingBuilderStream", outW, outH, metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface, null, workerHandler,
        )
        imageReader = reader
    }

    private fun releaseSurface() {
        try { imageReader?.close() } catch (_: Exception) {}
        try { virtualDisplay?.release() } catch (_: Exception) {}
        imageReader = null
        virtualDisplay = null
    }

    private fun encodeAndDispatch(image: Image) {
        try {
            val bitmap = imageToBitmap(image) ?: return
            val out = ByteArrayOutputStream(maxOf(16 * 1024, bitmap.byteCount / 8))
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
            bitmap.recycle()
            val jpeg = out.toByteArray()
            lastJpeg = jpeg
            onFrame(jpeg)
            sentFrames.incrementAndGet()
            // 统计窗口内实际发送帧率
            val now = android.os.SystemClock.uptimeMillis()
            val start = fpsWindowStart.get()
            if (start == 0L || now - start >= 1000) {
                if (fpsWindowStart.compareAndSet(start, now)) {
                    actualFps.set(fpsWindowCount.getAndSet(1))
                } else {
                    fpsWindowCount.incrementAndGet()
                }
            } else {
                fpsWindowCount.incrementAndGet()
            }
            // 自适应降帧：编码耗时占比高时拉长间隔，空闲时收紧
            val encodeCost = android.os.SystemClock.uptimeMillis() - now
            intervalMs = (encodeCost * 2).coerceIn(MIN_INTERVAL_MS, MAX_INTERVAL_MS)
        } catch (_: Exception) {
            // 单帧失败不影响采集循环
        }
    }

    /** RGBA_8888 Image → Bitmap（处理 rowStride 行对齐填充）。 */
    private fun imageToBitmap(image: Image): Bitmap? {
        val plane = image.planes.firstOrNull() ?: return null
        val width = image.width
        val height = image.height
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        val buffer = plane.buffer
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        if (pixelStride == 4 && rowStride == width * 4) {
            buffer.rewind()
            bitmap.copyPixelsFromBuffer(buffer)
        } else {
            val row = ByteArray(width * 4)
            val pixels = IntArray(width)
            for (y in 0 until height) {
                buffer.position(y * rowStride)
                buffer.get(row, 0, width * 4)
                for (x in 0 until width) {
                    val o = x * 4
                    // RGBA → ARGB
                    pixels[x] = ((row[o + 3].toInt() and 0xFF) shl 24) or
                        ((row[o + 0].toInt() and 0xFF) shl 16) or
                        ((row[o + 1].toInt() and 0xFF) shl 8) or
                        (row[o + 2].toInt() and 0xFF)
                }
                bitmap.setPixels(pixels, 0, width, 0, y, width, 1)
            }
        }
        return bitmap
    }
}

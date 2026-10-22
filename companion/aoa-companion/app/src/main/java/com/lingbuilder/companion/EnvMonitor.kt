package com.lingbuilder.companion

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Handler
import android.view.Display
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * 环境心跳：rotation（DisplayManager 实时监听）+ 当前帧尺寸 + 实测 fps + 前台应用。
 *
 * 前台应用用 UsageStatsManager 探测：需要用户在系统设置里授予「使用情况访问权限」；
 * 没有权限时 foreground = null（JSON null），完全不影响推流。
 */
class EnvMonitor(
    private val context: Context,
    private val screenStream: () -> ScreenStream?,
) {
    val rotation = AtomicInteger(0)
    val foregroundApp = AtomicReference<String?>(null)

    private val mainHandler = Handler(context.mainLooper)
    private var listener: DisplayManager.DisplayListener? = null
    private var usageStatsManager: UsageStatsManager? = null
    private var usageGranted = false

    fun start() {
        val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val display = displayManager.getDisplay(Display.DEFAULT_DISPLAY)
        rotation.set(rotationValue(display.rotation))
        listener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {
                if (displayId != Display.DEFAULT_DISPLAY) return
                val current = displayManager.getDisplay(Display.DEFAULT_DISPLAY)
                rotation.set(rotationValue(current.rotation))
            }
        }
        displayManager.registerDisplayListener(listener, mainHandler)

        usageStatsManager = try {
            context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        } catch (_: Exception) { null }
        usageGranted = hasUsageAccess()
    }

    fun stop() {
        try {
            (context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager)
                .unregisterDisplayListener(listener)
        } catch (_: Exception) {}
    }

    private fun rotationValue(value: Int): Int = when (value) {
        android.view.Surface.ROTATION_90 -> 90
        android.view.Surface.ROTATION_180 -> 180
        android.view.Surface.ROTATION_270 -> 270
        else -> 0
    }

    private fun hasUsageAccess(): Boolean {
        return try {
            (context.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager)
                .checkOpNoThrow(
                    android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    context.packageName,
                ) == android.app.AppOpsManager.MODE_ALLOWED
        } catch (_: Exception) {
            false
        }
    }

    /** 最近 2 秒内最后一次 MOVE_TO_FOREGROUND 的包名；无权限或查不到返回 null。 */
    private fun queryForegroundPackage(): String? {
        if (!usageGranted) return null
        val usm = usageStatsManager ?: return null
        return try {
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(now - 2000, now)
            var latest: String? = null
            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    latest = event.packageName
                }
            }
            latest
        } catch (_: Exception) {
            null
        }
    }

    fun buildEnvJson(): String {
        val stream = screenStream()
        val sb = StringBuilder()
        sb.append("{\"type\":\"env\",\"rotation\":").append(rotation.get())
        sb.append(",\"width\":").append(stream?.frameWidth?.get() ?: 0)
        sb.append(",\"height\":").append(stream?.frameHeight?.get() ?: 0)
        sb.append(",\"fps\":").append(stream?.actualFps?.get() ?: 0)
        val fg = queryForegroundPackage()
        sb.append(",\"foreground\":")
        if (fg == null) sb.append("null") else sb.append(JSONObject.quote(fg))
        sb.append("}")
        return sb.toString()
    }
}

package com.lingbuilder.companion

import android.util.Log
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale

/**
 * 1.2.2：进程内环形日志（真机排查通道问题时无 adb 可用，日志必须能显示在界面上——
 * 「日志」按钮打开弹窗即可看到全部记录，PC 侧经 WS 截屏可远程读取）。
 * 同时镜像到 logcat，未来接 adb 调试时历史可查。
 */
object AppLog {
    private const val MAX_LINES = 300
    private val lines = ArrayDeque<String>()
    private val fmt = SimpleDateFormat("HH:mm:ss.SSS", Locale.CHINA)

    /** 最近 maxLines 条日志的拼接文本（弹窗刷新用）。 */
    @Synchronized
    fun dump(): String = lines.joinToString("\n")

    @Synchronized
    fun d(tag: String, msg: String) {
        val line = fmt.format(Date()) + " [" + tag + "] " + msg
        lines.addLast(line)
        while (lines.size > MAX_LINES) lines.removeFirst()
        Log.d("LingBuilder." + tag, msg)
    }
}

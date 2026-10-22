package com.lingbuilder.companion

import android.content.Context
import android.content.Intent

/**
 * 1.2.0：App 任务自动化控制指令（launchApp / goHome / wakeScreen）。
 *
 * 与投屏解耦：MainActivity 在配件附着时可以只开「轻量指令通道」（不需要 MediaProjection
 * 投屏授权），StreamService 的投屏会话内也复用同一处理。回执一律经 reply 回调发回 PC：
 * {"type":"result","cmd":...,"target":...,"ok":bool[,"error":...]}
 *
 * 红线：launchApp/goHome 依赖「显示在其他应用上层」权限豁免安卓 10+ 后台启动限制（BAL），
 * 未授权时回执 ok:false + error。
 */
object ControlCommands {

    /**
     * 处理一条控制 JSON。返回 true 表示本对象已消费；
     * 返回 false 表示不是本对象职责（如 setScale/setQuality/stop 等投屏指令），调用方自行处理。
     */
    fun handle(context: Context, text: String, reply: (String) -> Unit): Boolean {
        val obj = try {
            org.json.JSONObject(text)
        } catch (_: Exception) {
            return false
        }
        return when (obj.optString("cmd")) {
            "launchApp" -> {
                val pkg = obj.optString("package").trim()
                val error = launchAppByPackage(context, pkg)
                replyResult(reply, "launchApp", pkg, error)
                true
            }
            "goHome" -> {
                val error = runCatching {
                    val home = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(home)
                }.exceptionOrNull()
                replyResult(reply, "goHome", "", error?.message ?: error?.javaClass?.simpleName)
                true
            }
            "wakeScreen" -> {
                val error = runCatching {
                    val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                    @Suppress("DEPRECATION")
                    val wl = pm.newWakeLock(
                        android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                            or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP
                            or android.os.PowerManager.ON_AFTER_RELEASE,
                        "lingbuilder:companion-wake",
                    )
                    // 点亮即走：5 秒后自动释放；只亮屏不解锁锁屏（安全边界，见 README）
                    wl.acquire(5000)
                }.exceptionOrNull()
                replyResult(reply, "wakeScreen", "", error?.message ?: error?.javaClass?.simpleName)
                true
            }
            else -> false
        }
    }

    /** 拉起指定包名的启动入口；返回 null=成功，非 null=中文失败原因。 */
    fun launchAppByPackage(context: Context, pkg: String): String? {
        if (pkg.isEmpty()) return "package 参数为空"
        val intent = try {
            context.packageManager.getLaunchIntentForPackage(pkg)
        } catch (e: Exception) {
            return "查询启动入口失败：" + (e.message ?: e.javaClass.simpleName)
        }
        if (intent == null) return "未安装或无启动入口：$pkg"
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            null
        } catch (e: Exception) {
            // 典型：BalException——应用在后台且无悬浮窗权限时被系统拦截
            "拉起被系统拒绝（检查是否已授予「显示在其他应用上层」权限）：" + (e.message ?: e.javaClass.simpleName)
        }
    }

    private fun replyResult(reply: (String) -> Unit, cmd: String, target: String, error: String?) {
        val sb = StringBuilder("{\"type\":\"result\",\"cmd\":\"")
        sb.append(org.json.JSONObject.quote(cmd).trim('"'))
        sb.append("\",\"target\":\"")
        sb.append(org.json.JSONObject.quote(target).trim('"'))
        sb.append("\",\"ok\":")
        sb.append(if (error == null) "true" else "false")
        if (error != null) {
            sb.append(",\"error\":\"")
            sb.append(org.json.JSONObject.quote(error).trim('"'))
            sb.append('"')
        }
        sb.append('}')
        reply(sb.toString())
    }
}

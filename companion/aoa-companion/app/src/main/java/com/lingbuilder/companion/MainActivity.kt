package com.lingbuilder.companion

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.hardware.usb.UsbAccessory
import android.hardware.usb.UsbManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import java.net.Inet4Address
import java.net.NetworkInterface

// 1.2.1：USB 配件授权完成的私有广播（requestPermission 的 PendingIntent 回投）
private const val ACTION_ACCESSORY_PERMISSION = "com.lingbuilder.companion.USB_ACCESSORY_PERMISSION"

class MainActivity : Activity() {

    private lateinit var pairingCode: TextView
    private lateinit var connString: TextView
    private lateinit var statusText: TextView
    private lateinit var btnToggle: Button
    private lateinit var etPort: EditText
    private lateinit var etScale: EditText
    private lateinit var etQuality: EditText

    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var prefs: android.content.SharedPreferences

    companion object {
        /** 1.2.2：轻量通道活跃标记（跨组件互斥）——StreamService.tryOpenUsbChannel 据此让位，
         *  防止两个组件同时 openAccessory 同一配件、两个读循环劈裂字节流（真机实锤）。 */
        @Volatile var lightChannelActive = false

        /** 1.2.6：投屏会话接管 USB 时，服务经此回调请求主界面立刻释放轻量通道 fd。
         *  主界面成功打开轻量通道时写入，通道关闭时清空；close() 跨线程安全（onDetached 同款）。 */
        @Volatile var lightChannelReleaser: (() -> Unit)? = null
    }

    private val statusPoller = object : Runnable {
        override fun run() {
            refreshStatus()
            // 1.4.3：投屏会话运行中前台必须让出配件接口——轻量通道握着 fd 时服务的
            // USB 直传打开必失败（双读者）。用户停在主界面点「开始投屏」正是这个时序，
            // 这里关掉轻量通道并立即通知服务重试 USB 直传（免重插免按钮）。
            if (StreamService.running && lightChannel?.isActive == true) {
                AppLog.d("USB", "投屏运行中：轻量通道让位给服务 USB 直传")
                lightChannel?.close()
                lightChannel = null
                lightChannelActive = false
                lightChannelReleaser = null
                try {
                    startService(
                        Intent(this@MainActivity, StreamService::class.java)
                            .setAction(StreamService.ACTION_AUTO_USB),
                    )
                } catch (_: Exception) {}
            }
            // 1.2.6：投屏会话结束后自动恢复轻量通道（配件仍在才尝试，避免无配件时空转刷日志）
            if (!StreamService.running && lightChannel?.isActive != true) {
                val usbManager = getSystemService(USB_SERVICE) as UsbManager
                val accessory = usbManager.accessoryList?.firstOrNull()
                if (accessory != null && usbManager.hasPermission(accessory)) {
                    maybeOpenLightControlChannel()
                }
            }
            mainHandler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        prefs = getSharedPreferences(StreamService.PREFS, Context.MODE_PRIVATE)

        // 1.2.1：标题栏显示版本号（动态读包信息，永不写死，装没装对版本一眼可辨）
        val verName = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "?"
        } catch (_: Exception) { "?" }
        actionBar?.title = "LingBuilder 投屏伴侣 v" + verName

        pairingCode = findViewById(R.id.pairingCode)
        connString = findViewById(R.id.connString)
        statusText = findViewById(R.id.statusText)
        btnToggle = findViewById(R.id.btnToggle)
        etPort = findViewById(R.id.etPort)
        etScale = findViewById(R.id.etScale)
        etQuality = findViewById(R.id.etQuality)

        etPort.setText(prefs.getInt(StreamService.KEY_PORT, 8788).toString())
        etScale.setText(prefs.getFloat(StreamService.KEY_SCALE, 0.5f).toString())
        etQuality.setText(prefs.getInt(StreamService.KEY_QUALITY, 70).toString())

        pairingCode.setOnClickListener {
            val token = StreamService.regenerateToken(this)
            showToken(token)
            Toast.makeText(this, "配对码已刷新，旧配对码立即失效", Toast.LENGTH_SHORT).show()
        }
        btnToggle.setOnClickListener { onToggleClicked() }
        findViewById<Button>(R.id.btnCopy).setOnClickListener {
            val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("conn", connString.text.toString()))
            Toast.makeText(this, "连接串已复制", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btnApply).setOnClickListener { onApplyClicked() }
        findViewById<Button>(R.id.btnLog).setOnClickListener { showLogDialog() }
        // 1.4.1：USB 直传显式开关——开关动作在 StreamService（ACTION_USB_DIRECT），状态在轮询里刷
        findViewById<Button>(R.id.btnUsb).setOnClickListener {
            startService(
                Intent(this, StreamService::class.java).setAction(StreamService.ACTION_USB_DIRECT),
            )
        }

        AppLog.d("MainActivity", "onCreate " + verName + " 附件列表=" + describeAccessories())

        showToken(StreamService.currentToken(this))
        registerUsbReceivers()
        maybePromptOverlayPermission()
    }

    // 1.2.1：配件附着与授权完成接收器。v1.2.0 缺陷：指令通道只在 onResume 开，
    // 「App 恰好一直开着时配件附着」没有任何触发点（真机实锤：通道永远打不开）；
    // MIUI 还会吞掉附着的系统授权弹窗，故授权改为程序化 requestPermission 触发。
    private val attachReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == UsbManager.ACTION_USB_ACCESSORY_ATTACHED) {
                AppLog.d("MainActivity", "收到配件附着广播，尝试开轻量通道")
                mainHandler.post { maybeOpenLightControlChannel() }
            }
        }
    }

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_ACCESSORY_PERMISSION) return
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            AppLog.d("MainActivity", "授权回执 granted=" + granted)
            if (granted) {
                maybeOpenLightControlChannel()
            } else {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "USB 配件权限被拒绝，PC 指令通道无法开启", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun describeAccessories(): String {
        val usbManager = getSystemService(USB_SERVICE) as UsbManager
        val list = usbManager.accessoryList
        if (list == null || list.isEmpty()) return "空"
        return list.joinToString("; ") { a ->
            (a.manufacturer ?: "?") + "/" + (a.model ?: "?") + "/" + (a.version ?: "?")
        }
    }

    /** 1.2.2：屏上日志弹窗——无 adb 的真机排查通道，PC 侧经 WS 截屏可远程读取。
     *  1.2.4：修复无法滚动——TextView 的 setTextIsSelectable 会抢占触摸事件与 ScrollView
     *  滚动冲突，改为只读并全屏化弹窗。 */
    private fun showLogDialog() {
        val text = TextView(this).apply {
            typeface = android.graphics.Typeface.MONOSPACE
            textSize = 11f
        }
        val scroll = android.widget.ScrollView(this).apply { addView(text) }
        val dialog = android.app.AlertDialog.Builder(this)
            .setTitle("运行日志（最近 300 条，可上下滚动）")
            .setView(scroll)
            .setPositiveButton("关闭", null)
            .create()
        val refresher = object : Runnable {
            override fun run() {
                if (!dialog.isShowing) return
                val atBottom = (scroll.scrollY + scroll.height) >= text.height - 40
                val prev = text.text
                text.text = AppLog.dump()
                // 只在本来就贴底时自动跟随到底部，用户上翻查阅时不打扰
                if (atBottom) scroll.post { scroll.smoothScrollTo(0, (text.height - scroll.height).coerceAtLeast(0)) }
                if (prev === text.text) Unit
                mainHandler.postDelayed(this, 500)
            }
        }
        dialog.show()
        dialog.window?.setLayout(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            (resources.displayMetrics.heightPixels * 0.85).toInt(),
        )
        mainHandler.post(refresher)
    }

    private fun registerUsbReceivers() {
        val attachFilter = IntentFilter(UsbManager.ACTION_USB_ACCESSORY_ATTACHED)
        val permFilter = IntentFilter(ACTION_ACCESSORY_PERMISSION)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(attachReceiver, attachFilter, Context.RECEIVER_NOT_EXPORTED)
            registerReceiver(permissionReceiver, permFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(attachReceiver, attachFilter)
            registerReceiver(permissionReceiver, permFilter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try { unregisterReceiver(attachReceiver) } catch (_: Exception) {}
        try { unregisterReceiver(permissionReceiver) } catch (_: Exception) {}
    }

    /** 1.2.0：launchApp/goHome 依赖「显示在其他应用上层」权限豁免后台启动限制（BAL），一次性引导 */
    private fun maybePromptOverlayPermission() {
        if (android.provider.Settings.canDrawOverlays(this)) return
        val prefs = getSharedPreferences(StreamService.PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(StreamService.KEY_OVERLAY_ASKED, false)) return
        prefs.edit().putBoolean(StreamService.KEY_OVERLAY_ASKED, true).apply()
        android.app.AlertDialog.Builder(this)
            .setTitle("建议开启悬浮窗权限")
            .setMessage(
                "安卓限制后台应用拉起其它应用。授予「显示在其他应用上层」后，" +
                    "PC 才能通过 USB 数据通道远程打开指定 App（launchApp 指令）。"
            )
            .setPositiveButton("去授权") { _, _ ->
                startActivity(
                    Intent(
                        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName"),
                    )
                )
            }
            .setNegativeButton("暂不", null)
            .show()
    }

    override fun onResume() {
        super.onResume()
        mainHandler.post(statusPoller)
        AppLog.d("MainActivity", "onResume 尝试开轻量通道，附件列表=" + describeAccessories())
        maybeOpenLightControlChannel()
    }

    /**
     * 1.2.0：轻量指令通道——配件已附着且权限已授时直接打开 USB 控制通道（不需要投屏授权）。
     * 让 launchApp/goHome/wakeScreen 在「没开投屏」的常态下也可用；StreamService 的投屏会话
     * 打开同一配件会失败，属预期（视频走 WS，指令走本通道）。
     */
    private fun maybeOpenLightControlChannel() {
        if (lightChannel?.isActive == true) { AppLog.d("USB", "轻量通道已活跃，跳过"); return }
        // 1.2.6：投屏会话运行中 USB 归 StreamService（视频走 USB 通道 1、指令回执走通道 2），
        // 主界面不再抢开轻量通道——否则服务永远拿不到配件 fd，USB 视频主路径被锁死
        if (StreamService.running) {
            AppLog.d("USB", "投屏会话运行中，轻量通道让位给服务")
            return
        }
        // 1.4.1：USB 直传占用配件通道期间轻量通道让位（同一条 bulk 端点，双读者会劈裂）
        if (StreamService.usbDirectOn) {
            AppLog.d("USB", "USB 直传占用配件通道，轻量通道让位")
            return
        }
        val usbManager = getSystemService(USB_SERVICE) as UsbManager
        val accessory = usbManager.accessoryList?.firstOrNull()
        if (accessory == null) { AppLog.d("USB", "开轻量通道失败：附件列表为空"); return }
        if (!usbManager.hasPermission(accessory)) {
            AppLog.d("USB", "无配件权限，程序化请求授权弹窗")
            // 1.2.1：v1.2.0 在这里静默返回，而系统附着弹窗被 MIUI 吞掉后权限永远授不上
            // （真机实锤：弹窗从未出现、通道永远打不开）。改为程序化请求授权；
            // 用户勾选「默认」后长期有效。UsbManager 需要往 PendingIntent 里填回执 extras，
            // API 31+ 必须允许 MUTABLE。
            val flags = if (Build.VERSION.SDK_INT >= 31)
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            else
                PendingIntent.FLAG_UPDATE_CURRENT
            val intent = Intent(ACTION_ACCESSORY_PERMISSION).setPackage(packageName)
            usbManager.requestPermission(accessory, PendingIntent.getBroadcast(this, 0, intent, flags))
            return
        }
        AppLog.d("USB", "权限已授，打开轻量通道 fd")
        val channel = UsbDataChannel(
            usbManager,
            onControlJson = { text ->
                AppLog.d("USB", "收到控制帧 " + text.take(120))
                // 回执直接经本通道发回 PC（UsbDataChannel 写路径内部已同步）
                ControlCommands.handle(this@MainActivity, text) { json ->
                    AppLog.d("USB", "回执 " + json.take(120))
                    lightChannel?.sendControlJson(json)
                }
            },
            onDetached = {
                AppLog.d("USB", "轻量通道断开（读循环退出/IO 错误），2 秒后自动重试")
                lightChannelActive = false
                mainHandler.postDelayed({
                    maybeOpenLightControlChannel()
                    // 1.2.5：重试仍失败且投屏会话在跑时，由服务接管 USB 通道（指令后台可用）
                    if (lightChannel?.isActive != true) {
                        try {
                            startService(
                                Intent(this@MainActivity, StreamService::class.java)
                                    .setAction(StreamService.ACTION_TRY_USB),
                            )
                        } catch (_: Exception) {}
                    }
                }, 2000)
            },
        )
        val ok = channel.open(accessory)
        AppLog.d("USB", "轻量通道 open 结果=" + ok + (if (ok) "" else " lastError=" + channel.lastError))
        if (ok) {
            lightChannel = channel
            lightChannelActive = true
            lightChannelReleaser = {
                lightChannel?.close()
                lightChannel = null
                lightChannelActive = false
            }
            runOnUiThread {
                Toast.makeText(this, "PC 指令通道已连接（轻量模式）", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private var lightChannel: UsbDataChannel? = null

    override fun onPause() {
        super.onPause()
        mainHandler.removeCallbacks(statusPoller)
        // 轻量指令通道随界面生命周期关闭；投屏会话内的指令通道不受影响（由 StreamService 管理）
        val hadLight = lightChannel?.isActive == true
        lightChannel?.close()
        lightChannel = null
        lightChannelActive = false
        lightChannelReleaser = null
        AppLog.d("USB", "onPause 关闭轻量通道")
        // 1.2.5：退后台（如 launchApp 拉起目标 App）后，投屏会话运行中由服务接管 USB 通道
        if (hadLight && StreamService.running) {
            try {
                startService(
                    Intent(this, StreamService::class.java).setAction(StreamService.ACTION_TRY_USB),
                )
            } catch (_: Exception) {}
        }
    }

    private fun showToken(token: String) {
        pairingCode.text = token
        connString.text = "ws://" + lanIpAddress() + ":" + currentPort() + "/stream?token=" + token
    }

    private fun currentPort(): Int = etPort.text.toString().toIntOrNull()?.coerceIn(1024, 65535) ?: 8788

    private fun refreshStatus() {
        if (StreamService.running) {
            val foreground = StreamService.lastForeground?.let { "，前台：$it" } ?: ""
            statusText.text = "推流中 ws://" + lanIpAddress() + ":" + StreamService.serverPort + " " +
                "客户端 ${StreamService.clientCount}，" +
                "${StreamService.lastFps} fps，画面 ${StreamService.frameSize}，" +
                "旋转 ${StreamService.lastRotation}°$foreground" +
                (if (StreamService.serverError.isBlank()) "" else "，注意：${StreamService.serverError}")
            btnToggle.text = getString(R.string.stop_stream)
        } else {
            statusText.text = if (StreamService.serverError.isBlank()) "未推流" else "上次错误：${StreamService.serverError}"
            btnToggle.text = getString(R.string.start_stream)
        }
        // 1.4.1：USB 直传状态（开关动作在 StreamService，这里只刷标签）
        // 1.4.3：失败原因上状态行（自动路径静默，用户必须能看到卡在哪一步）
        findViewById<Button>(R.id.btnUsb).text =
            if (StreamService.usbDirectOn) "USB 直传：开（画面走 USB）"
            else if (StreamService.usbDirectError.isNotBlank()) "USB 直传：失败（${StreamService.usbDirectError}）"
            else "USB 直传：关"
        connString.text = "ws://" + lanIpAddress() + ":" + currentPort() + "/stream?token=" + pairingCode.text.toString()
    }

    private fun lanIpAddress(): String {
            try {
                val interfaces = NetworkInterface.getNetworkInterfaces()
                while (interfaces.hasMoreElements()) {
                    val ni = interfaces.nextElement()
                    if (!ni.isUp || ni.isLoopback) continue
                    val name = ni.name.lowercase()
                    if (!(name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("eth"))) continue
                    val addresses = ni.inetAddresses
                    while (addresses.hasMoreElements()) {
                        val addr = addresses.nextElement()
                        if (addr is Inet4Address && !addr.isLoopbackAddress) return addr.hostAddress ?: ""
                    }
                }
                // 兜底：任意非回环 IPv4
                val all = NetworkInterface.getNetworkInterfaces()
                while (all.hasMoreElements()) {
                    val addresses = all.nextElement().inetAddresses
                    while (addresses.hasMoreElements()) {
                        val addr = addresses.nextElement()
                        if (addr is Inet4Address && !addr.isLoopbackAddress) return addr.hostAddress ?: ""
                    }
                }
            } catch (_: Exception) {}
            return "0.0.0.0"
        }

    private fun onToggleClicked() {
        if (StreamService.running) {
            stopService(Intent(this, StreamService::class.java))
            return
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
            return // 授权回调里继续
        }
        requestProjection()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100) requestProjection()
    }

    private fun requestProjection() {
        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(manager.createScreenCaptureIntent(), 200)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 200) return
        if (resultCode != Activity.RESULT_OK || data == null) {
            Toast.makeText(this, "未授予投屏权限，无法开始", Toast.LENGTH_SHORT).show()
            return
        }
        // 端口/缩放/质量随开始生效
        onApplyClicked()
        val service = Intent(this, StreamService::class.java)
            .setAction(StreamService.ACTION_START)
            .putExtra(StreamService.EXTRA_RESULT_CODE, resultCode)
            .putExtra(StreamService.EXTRA_RESULT_DATA, data)
        startForegroundService(service)
    }

    private fun onApplyClicked() {
        val port = etPort.text.toString().toIntOrNull()?.coerceIn(1024, 65535) ?: 8788
        val scale = (etScale.text.toString().toFloatOrNull() ?: 0.5f).coerceIn(0.25f, 1.0f)
        val quality = etQuality.text.toString().toIntOrNull()?.coerceIn(40, 90) ?: 70
        prefs.edit()
            .putInt(StreamService.KEY_PORT, port)
            .putFloat(StreamService.KEY_SCALE, scale)
            .putInt(StreamService.KEY_QUALITY, quality)
            .apply()
        StreamService.applyRuntimeSettings(this, scale, quality)
        showToken(pairingCode.text.toString())
    }
}

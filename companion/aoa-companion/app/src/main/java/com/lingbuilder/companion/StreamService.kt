package com.lingbuilder.companion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.hardware.usb.UsbAccessory
import android.hardware.usb.UsbManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.widget.Toast
import kotlin.concurrent.thread

/**
 * 投屏前台服务：持有 MediaProjection，运行 WebSocket 服务器与 1 秒环境心跳。
 *
 * 状态通过 Companion 的 @Volatile 字段暴露给 MainActivity 轮询展示（不引第三方事件总线）。
 */
class StreamService : Service() {

    companion object {
        const val ACTION_START = "com.lingbuilder.companion.START"
        const val ACTION_STOP = "com.lingbuilder.companion.STOP"
        /** 1.2.5：轻量通道随主界面退后台关闭后，通知投屏会话接管 USB 通道（指令后台可用）。 */
        const val ACTION_TRY_USB = "com.lingbuilder.companion.TRY_USB"
        /** 1.4.1：USB 直传显式开关（手机按钮或 PC 经 WS 下发 usbDirect 指令）。 */
        const val ACTION_USB_DIRECT = "com.lingbuilder.companion.USB_DIRECT"
        /** 1.4.3：USB 直传自动重试（主界面轻量通道让位后由状态轮询触发；失败静默不弹 toast）。 */
        const val ACTION_AUTO_USB = "com.lingbuilder.companion.AUTO_USB"
        /** 1.4.7：USB 控制模式（不推流）启动 extra——投屏授权照走，但不建 WS 不推帧，
         *  仅保持 USB 通道 + lastJpeg 缓存供 screenshot 按需截图（找图群控不依赖持续推流）。 */
        const val EXTRA_ON_DEMAND = "ondemand"
        /** 1.4.1：openAccessory 前的程序化授权回执 action（服务私有）。 */
        const val ACTION_USB_PERMISSION = "com.lingbuilder.companion.USB_PERMISSION_SVC"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"

        const val PREFS = "companion"
        const val KEY_PORT = "port"
        const val KEY_SCALE = "scale"
        const val KEY_QUALITY = "quality"
        const val KEY_OVERLAY_ASKED = "overlay_asked"
        const val KEY_TOKEN = "token"

        @Volatile var running = false
            private set
        @Volatile var serverPort = 8788
        @Volatile var clientCount = 0
        @Volatile var lastFps = 0
        @Volatile var frameSize = "0x0"
        @Volatile var lastRotation = 0
        @Volatile var lastForeground: String? = null
        @Volatile var serverError = ""
        @Volatile var rejectedTotal = 0L
        /** 1.4.1：USB 直传开关状态（视频帧是否走 USB bulk 通道）。 */
        @Volatile var usbDirectOn = false
            private set
        @Volatile var usbDirectError = ""

        @Volatile private var instance: StreamService? = null

        /** 每次连接校验都用最新配对码；App 侧刷新配对码立即生效。 */
        fun currentToken(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            var token = prefs.getString(KEY_TOKEN, null)
            if (token == null || token.length != 6 || token.any { it !in '0'..'9' }) {
                token = newToken()
                prefs.edit().putString(KEY_TOKEN, token).apply()
            }
            return token
        }

        fun regenerateToken(context: Context): String {
            val token = newToken()
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_TOKEN, token).apply()
            return token
        }

        fun applyRuntimeSettings(context: Context, scale: Float?, quality: Int?) {
            instance?.applySettings(scale, quality)
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (scale != null) prefs.edit().putFloat(KEY_SCALE, scale).apply()
            if (quality != null) prefs.edit().putInt(KEY_QUALITY, quality).apply()
        }

        private fun newToken(): String = (100000..999999).random().toString()
    }

    private var server: WsServer? = null
    private var screenStream: ScreenStream? = null
    private var envMonitor: EnvMonitor? = null
    private var heartbeatThread: Thread? = null
    private var beacon: BeaconBroadcaster? = null
    private lateinit var prefs: SharedPreferences
    private var usbChannel: UsbDataChannel? = null
    private var usbReceiver: BroadcastReceiver? = null
    /** 1.4.1：ATTACHED 广播里的配件对象。配件化后 accessoryList 不含自己（v1.3.4 实锤），
     *  这是 openAccessory 唯一可靠来源；app 重启错过广播时回退 accessoryList 兜底。 */
    @Volatile private var attachedAccessory: UsbAccessory? = null

    /** 本机配件序列号（v1.3.4）：PC 识别串第 5 段下发的手机真实 SN。
     *  手机被配件化时 UsbManager.accessoryList 不包含自己，唯一来源是
     *  ACTION_USB_ACCESSORY_ATTACHED 广播的 EXTRA_ACCESSORY，收到即缓存。 */
    @Volatile var accessorySerial = ""
        private set

    private val usbManager: UsbManager by lazy {
        getSystemService(USB_SERVICE) as UsbManager
    }

    /** 视频帧路由：USB 数据通道活跃走 bulk（USB 优先），否则走 WebSocket。 */
    private fun dispatchFrame(jpeg: ByteArray) {
        val channel = usbChannel
        if (channel != null && channel.isActive) {
            channel.sendVideoFrame(jpeg)
        } else {
            server?.broadcastBytes(jpeg)
        }
    }

    private val usbReceiverImpl = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                UsbManager.ACTION_USB_ACCESSORY_ATTACHED -> {
                    // v1.3.4：只取配件序列号供自动发现信标对齐，不再接管数据通道
                    val accessory = if (Build.VERSION.SDK_INT >= 33) {
                        intent.getParcelableExtra(UsbManager.EXTRA_ACCESSORY, UsbAccessory::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_ACCESSORY)
                    }
                    accessorySerial = accessory?.serial ?: ""
                    attachedAccessory = accessory
                    AppLog.d("服务", "配件附着 serial=[" + accessorySerial + "]")
                    // 1.4.2：投屏运行中检测到配件 → 自动接通 USB 直传（免 Wi-Fi 形态的默认路径，
                    // 不依赖手机按钮/重插时序；失败静默留痕，手动「USB 直传」按钮保留）
                    maybeAutoOpenUsbDirect()
                }
                UsbManager.ACTION_USB_ACCESSORY_DETACHED -> {
                    accessorySerial = ""
                    attachedAccessory = null
                }
            }
        }
    }

    /** v1.3.2 起投屏视频固定走 Wi-Fi（WS 全程保持），USB 数据通道自动接管整体停用：
     *  接管会停掉 WS 服务，而 PC 端已改为信标自动发现 + Wi-Fi 推流，接管只会制造
     *  「信标广播死地址」与长链路等待（切配件/驱动绑定/30 秒超时）。USB 硬件保留给
     *  PC 侧 AOA HID 点击与控制（不经 app 代码）。本函数保留为 no-op 以稳住既有调用点。 */
    private fun tryOpenUsbChannel() {
        if (!running) return
        AppLog.d("服务", "v1.3.2 起投屏视频固定 Wi-Fi，不再接管 USB 数据通道")
    }

    private val usbPermissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_USB_PERMISSION) return
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            AppLog.d("USB直传", "授权回执 granted=" + granted)
            if (granted) openUsbDirect()
            else {
                usbDirectError = "USB 配件权限被拒绝"
                toastUi(usbDirectError)
            }
        }
    }

    /** 1.4.1：USB 直传（显式开关）——把视频帧切到 USB bulk 通道（LBAC 通道 1）。
     *  与 v1.3.2 前的「自动接管」不同：只在用户于手机上点「USB 直传」按钮或 PC 经 WS
     *  下发 {"cmd":"usbDirect","on":true} 时开启。WS 服务器不拆除（画面路由由 dispatchFrame
     *  决定，零客户端时只是空转）；信标在通道活跃期间停发（沿用 v1.3.1 语义，防死地址空连）。 */
    private fun toggleUsbDirect() {
        if (usbChannel?.isActive == true) {
            AppLog.d("USB直传", "用户关闭 USB 直传，恢复 WS 推流")
            usbDirectOn = false
            closeUsbChannel()
            toastUi("USB 直传已关闭，恢复 Wi-Fi 推流")
            return
        }
        openUsbDirect()
    }

    private fun openUsbDirect(auto: Boolean = false) {
        // 失败汇报：手动路径弹 toast；自动路径静默留痕（usbDirectError 供 UI 轮询展示），防 toast 风暴
        fun fail(msg: String) {
            usbDirectError = msg
            if (auto) AppLog.d("USB直传", "自动接通失败：" + msg)
            else toastUi(msg)
        }
        if (!running) {
            fail("投屏会话未运行：请先点「开始投屏」再开 USB 直传")
            return
        }
        val accessory = attachedAccessory ?: intentAccessory()
        if (accessory == null) {
            fail("未找到 USB 配件：请先在电脑端对接本机（切到配件模式），或重插一次数据线")
            return
        }
        if (!usbManager.hasPermission(accessory)) {
            AppLog.d("USB直传", "无配件权限，程序化请求授权弹窗")
            // API 31+ PendingIntent 必须允许 MUTABLE 才能带回执 extras（同轻量通道配方）
            val flags = if (Build.VERSION.SDK_INT >= 31)
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            else
                PendingIntent.FLAG_UPDATE_CURRENT
            val intent = Intent(ACTION_USB_PERMISSION).setPackage(packageName)
            usbManager.requestPermission(accessory, PendingIntent.getBroadcast(this, 0, intent, flags))
            return
        }
        val channel = UsbDataChannel(
            usbManager,
            onControlJson = { text -> handleControlMessage(text) },
            onDetached = {
                AppLog.d("USB直传", "通道断开（读循环退出/IO 错误），恢复 WS 推流")
                mainHandler.post {
                    usbDirectOn = false
                    closeUsbChannel()
                }
            },
        )
        if (!channel.open(accessory)) {
            fail("打开 USB 通道失败：" + channel.lastError)
            return
        }
        usbChannel = channel
        usbDirectOn = true
        usbDirectError = ""
        AppLog.d("USB直传", "已接通：视频帧走 USB bulk（LBAC 通道 1）")
        toastUi("USB 直传已接通：画面走 USB（Wi-Fi 画面停止）")
        replyControl("{\"type\":\"usbDirect\",\"ok\":true,\"on\":true}")
    }

    private fun toastUi(msg: String) {
        mainHandler.post {
            try { Toast.makeText(this, msg, Toast.LENGTH_LONG).show() } catch (_: Exception) {}
        }
    }

    private fun intentAccessory(): UsbAccessory? {
        val present = usbManager.accessoryList ?: return null
        return present.firstOrNull()
    }

    private fun closeUsbChannel() {
        usbDirectOn = false
        usbChannel?.close()
        usbChannel = null
        // 数据通道断开：恢复 WebSocket 推流（若服务仍在运行且投屏仍授权）
        if (running && screenStream != null && server?.isRunning() == false) {
            val ws = WsServer(
                port = serverPort,
                tokenProvider = { currentToken(this) },
                onClientConnected = { clientCount = server?.clients?.size ?: 0 },
                onClientDisconnected = { clientCount = server?.clients?.size ?: 0 },
                onTextMessage = { _, text -> handleControlMessage(text) },
            )
            ws.start()
            if (ws.isRunning()) server = ws
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        when (intent?.action) {
            ACTION_STOP -> {
                shutdownLocked()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                startInForeground()
                if (!running) startStream(intent)
            }
            ACTION_TRY_USB -> {
                // 1.2.5：轻量通道随主界面生命周期关闭后，投屏会话运行中由服务接管 USB 通道
                // （指令在后台仍可用；USB 优先会停用 WS 推流，回观看器自行重连）
                if (running) tryOpenUsbChannel()
            }
            ACTION_USB_DIRECT -> toggleUsbDirect()
            ACTION_AUTO_USB -> maybeAutoOpenUsbDirect()
            else -> {
                // 系统重启服务但没有投屏授权数据：直接退出，避免无授权空转
                stopSelf()
                return START_NOT_STICKY
            }
        }
        return START_NOT_STICKY
    }

    private fun startInForeground() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            "stream", getString(R.string.notification_channel), NotificationManager.IMPORTANCE_LOW,
        )
        manager.createNotificationChannel(channel)
        val notification: Notification
        if (Build.VERSION.SDK_INT >= 29) {
            notification = Notification.Builder(this, "stream")
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(getString(R.string.notification_title))
                .setContentText(getString(R.string.notification_text))
                .setOngoing(true)
                .build()
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            notification = Notification.Builder(this, "stream")
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(getString(R.string.notification_title))
                .setContentText(getString(R.string.notification_text))
                .setOngoing(true)
                .build()
            startForeground(1, notification)
        }
    }

    private fun startStream(intent: Intent) {
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1)
        @Suppress("DEPRECATION")
        val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
        if (resultData == null) {
            serverError = "缺少系统投屏授权数据，请从「开始投屏」按钮重新发起"
            stopSelf()
            return
        }

        serverPort = prefs.getInt(KEY_PORT, 8788).coerceIn(1024, 65535)
        val savedScale = prefs.getFloat(KEY_SCALE, 0.5f).coerceIn(0.25f, 1.0f)
        val savedQuality = prefs.getInt(KEY_QUALITY, 70).coerceIn(40, 90)

        serverError = ""
        val onDemand = intent.getBooleanExtra(EXTRA_ON_DEMAND, false)
        val mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = try {
            mediaProjectionManager.getMediaProjection(resultCode, resultData)
        } catch (e: Exception) {
            serverError = "取得投屏授权失败：" + (e.message ?: e.javaClass.simpleName)
            stopSelf()
            return
        }

        if (!onDemand) {
            val wsServer = WsServer(
                port = serverPort,
                tokenProvider = { currentToken(this) },
                onClientConnected = { clientCount = server?.clients?.size ?: 0 },
                onClientDisconnected = { clientCount = server?.clients?.size ?: 0 },
                onTextMessage = { _, text -> handleControlMessage(text) },
            )
            server = wsServer
            wsServer.start()
            if (!wsServer.isRunning()) {
                serverError = "WebSocket 服务端启动失败（端口 $serverPort 可能被占用），请换端口后重试"
                stopSelf()
                return
            }
        }

        val stream = ScreenStream(
            this, projection,
            onFrame = { jpeg ->
                // 1.4.7 控制模式：不推流（lastJpeg 缓存由 ScreenStream 内部完成），帧仅按 screenshot 指令单发
                if (!onDemand) {
                    lastFps = streamFpsSnapshot()
                    dispatchFrame(jpeg)
                }
            },
            onScreenChanged = { broadcastScreenChanged() },
        ).also {
            it.scale = savedScale
            it.quality = savedQuality
        }
        screenStream = stream
        envMonitor = EnvMonitor(this) { screenStream }.also { it.start() }
        stream.start()
        if (stream.isStopped()) {
            // 用户可能在极短时间内从系统面板关掉了投屏
            shutdownLocked()
            stopSelf()
            return
        }

        heartbeatThread = thread(name = "env-heartbeat") {
            while (running && !Thread.currentThread().isInterrupted) {
                try {
                    val env = envMonitor?.buildEnvJson() ?: continue
                    // 心跳双路：USB 通道走控制 JSON（通道 2），WebSocket 走文本帧
                    val channel = usbChannel
                    if (channel != null && channel.isActive) channel.sendControlJson(env)
                    else server?.broadcastText(env)
                    lastRotation = envMonitor?.rotation?.get() ?: 0
                    lastForeground = envMonitor?.foregroundApp?.get()
                    frameSize = (screenStream?.frameWidth?.get() ?: 0).toString() + "x" + (screenStream?.frameHeight?.get() ?: 0)
                    rejectedTotal = server?.rejectedCount?.get() ?: 0
                } catch (_: Exception) {
                }
                try { Thread.sleep(1000) } catch (e: InterruptedException) { break }
            }
        }

        // 1.4.7 控制模式（不推流）不启信标（无 WS 地址可广播），直接完成会话装配。
        if (onDemand) {
            running = true
            instance = this
            val filter = IntentFilter().apply {
                addAction(UsbManager.ACTION_USB_ACCESSORY_ATTACHED)
                addAction(UsbManager.ACTION_USB_ACCESSORY_DETACHED)
            }
            usbReceiver = usbReceiverImpl
            registerReceiver(usbReceiverImpl, filter)
            registerReceiver(usbPermissionReceiver, IntentFilter(ACTION_USB_PERMISSION))
            try { accessorySerial = usbManager.accessoryList?.firstOrNull()?.serial ?: "" } catch (_: Exception) {}
            maybeAutoOpenUsbDirect()
            AppLog.d("服务", "USB 控制模式已启动（不推流，按需截图）")
            return
        }
        // 投屏自动发现信标（v1.3.0）：会话存活期间每 3 秒广播连接串，PC 查看器免手抄自动接入。
        // ws 地址动态构造（端口各机不同、配对码可刷新），拿不到本机局域网 IP 时不广播。
        beacon = BeaconBroadcaster(
            wsUrlProvider = { buildBeaconWsUrl() },
            frameSizeProvider = {
                intArrayOf(screenStream?.frameWidth?.get() ?: 0, screenStream?.frameHeight?.get() ?: 0)
            },
            fpsProvider = { lastFps },
            serialProvider = { accessorySerial },
        ).also { it.start() }

        // v1.3.2：不再接管 USB 数据通道；v1.3.4：恢复配件附着监听——只为读序列号供信标对齐
        running = true
        instance = this

        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_ACCESSORY_ATTACHED)
            addAction(UsbManager.ACTION_USB_ACCESSORY_DETACHED)
        }
        usbReceiver = usbReceiverImpl
        registerReceiver(usbReceiverImpl, filter)
        registerReceiver(usbPermissionReceiver, IntentFilter(ACTION_USB_PERMISSION))
        // 若手机在 app 启动前已处于配件模式（错过广播），尝试从 accessoryList 兜底读一次
        try { accessorySerial = usbManager.accessoryList?.firstOrNull()?.serial ?: "" } catch (_: Exception) {}
        // 1.4.2：投屏会话起来时配件已在位（先开 app 后插线/PC 已切配件）→ 自动接通 USB 直传
        maybeAutoOpenUsbDirect()
    }

    /** 1.4.2：USB 直传自动接通——投屏运行中且配件已知时自动把视频帧切到 USB bulk。
     *  背景：v1.3.2 为 Wi-Fi 信标方案停用了自动接管，纯 USB（手机不连 Wi-Fi）形态下
     *  帧会全部涌向无客户端的 WS 服务＝黑屏。这里只在投屏运行、通道未开时触发一次，
     *  失败静默（usbDirectError 留痕、UI 轮询可见），不弹 toast 不循环重试；
     *  配件再次附着（重插）或投屏重新开始时会再触发，手动按钮仍走 openUsbDirect()。 */
    private fun maybeAutoOpenUsbDirect() {
        if (!running) return
        if (usbChannel?.isActive == true) return
        if (attachedAccessory == null && intentAccessory() == null) return
        AppLog.d("USB直传", "自动接通：投屏运行中检测到配件")
        openUsbDirect(auto = true)
    }

    /** 自动发现信标里的 ws 连接串：本机局域网 IPv4 + 实际端口 + 当前配对码。
     *  USB 数据通道活跃（投屏会话运行中）时 WS 推流服务已被接管停用，继续广播死地址
     *  会诱使 PC 反复空连：停发信标（v1.3.1）。下线信标在 shutdown 时 running 已置假，不受影响；
     *  USB 拔出恢复 WS 推流后信标自动恢复。 */
    private fun buildBeaconWsUrl(): String {
        if (running && usbChannel?.isActive == true) return ""
        val ip = BeaconBroadcaster.localIpv4()?.hostAddress ?: return ""
        return "ws://$ip:$serverPort/stream?token=${currentToken(this)}"
    }

    private fun streamFpsSnapshot(): Int = screenStream?.actualFps?.get() ?: 0

    /**
     * PC → 手机控制指令：{"cmd":"setScale"/"setQuality"/"stop"}；USB 通道上另有 {"cmd":"ping"} 心跳。
     * 1.2.0 新增 App 任务自动化三指令（执行结果一律经控制通道回执，PC 侧 AOA_数据通道收帧 可读）：
     * - {"cmd":"launchApp","package":"com.jingdong.app.mall"} 拉起指定应用
     * - {"cmd":"goHome"} 回到桌面
     * - {"cmd":"wakeScreen"} 点亮屏幕（不解锁锁屏，安全边界）
     * 1.4.0 新增坐标回映射查询（纯读，不触发虚拟屏重建；回执经 replyControl 广播给全部已握手客户端）：
     * - {"cmd":"queryScreen","id":"可选回显标识"} → {"type":"screenInfo",...}；旋转/档位变化重建
     *   虚拟屏时另行广播 {"type":"screenChanged",...}（无 id），旧客户端按未知消息忽略即可。
     * 红线：launchApp/goHome 依赖「显示在其他应用上层」权限豁免安卓 10+ 后台启动限制（BAL），
     * 未授权时回执 ok:false + error，主界面会引导用户开启。
     */
    private fun handleControlMessage(text: String) {
        try {
            AppLog.d("指令", "收到 " + text.take(120))
            val obj = org.json.JSONObject(text)
            when (obj.optString("cmd")) {
                "setScale" -> screenStream?.applyScale(obj.optDouble("value", 0.5).toFloat())
                "setQuality" -> {
                    val q = obj.optInt("value", 70).coerceIn(40, 90)
                    screenStream?.quality = q
                    prefs.edit().putInt(KEY_QUALITY, q).apply()
                }
                "queryScreen" -> {
                    val id = obj.optString("id", "")
                    val json = screenInfoJson("screenInfo", if (id.isEmpty()) null else id)
                    if (json != null) replyControl(json)
                }
                "ping" -> replyControl(
                    "{\"type\":\"pong\",\"uptime\":" + android.os.SystemClock.elapsedRealtime() + "}",
                )
                "listApps" -> {
                    // 1.4.6：枚举有启动入口的已装应用（{"cmd":"listApps"} → {"type":"appList","apps":[...]}），
                    // PC 端填充「启动App」下拉。包可见性 <queries> 声明已含 MAIN+LAUNCHER，Android 11+ 可枚举。
                    mainHandler.post {
                        val json = try {
                            val pm = applicationContext.packageManager
                            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                            val infos = pm.queryIntentActivities(intent, 0)
                            val arr = StringBuilder("[")
                            var first = true
                            for (info in infos) {
                                val pkg = info.activityInfo?.packageName ?: continue
                                if (pkg == applicationContext.packageName) continue
                                val label = try { info.loadLabel(pm)?.toString() ?: pkg } catch (_: Exception) { pkg }
                                if (!first) arr.append(",")
                                first = false
                                arr.append("{\"pkg\":\"").append(org.json.JSONObject.quote(pkg).trim('"'))
                                arr.append("\",\"label\":\"").append(org.json.JSONObject.quote(label).trim('"')).append("\"}")
                            }
                            arr.append("]")
                            "{\"type\":\"appList\",\"apps\":" + arr + "}"
                        } catch (e: Exception) {
                            null
                        }
                        if (json != null) {
                            replyControl(json)
                        } else {
                            replyControl("{\"type\":\"result\",\"cmd\":\"listApps\",\"target\":\"\",\"ok\":false,\"error\":\"枚举应用失败\"}")
                        }
                    }
                }
                "screenshot" -> {
                    // 1.4.7：按需截图——把 lastJpeg 经当前数据通道单发一帧（PC 泵照常收帧落盘）。
                    // 投屏推流与 USB 控制模式（不推流）都可用；均未运行时回执中文错误。
                    val stream = screenStream
                    val shot = stream?.lastJpeg
                    val channel = usbChannel
                    if (shot == null) {
                        replyControl("{\"type\":\"result\",\"cmd\":\"screenshot\",\"target\":\"\",\"ok\":false,\"error\":\"无可用的屏幕画面：请先开始投屏，或在伴侣上点「USB 控制模式」\"}")
                    } else if (channel == null || !channel.isActive) {
                        replyControl("{\"type\":\"result\",\"cmd\":\"screenshot\",\"target\":\"\",\"ok\":false,\"error\":\"USB 数据通道未激活\"}")
                    } else {
                        channel.sendVideoFrame(shot)
                        replyControl("{\"type\":\"result\",\"cmd\":\"screenshot\",\"target\":\"\",\"ok\":true}")
                    }
                }
                "setClipboard" -> {
                    // 1.4.5：PC 侧中文输入路径的第一步——把文本写进系统剪贴板
                    //（{"cmd":"setClipboard","text":"..."} → {"type":"result","cmd":"setClipboard","ok":true}）。
                    // 粘贴动作由 PC 经 AOA 键盘注入 Ctrl+V 完成（HID 组合键）。
                    val text = obj.optString("text", "")
                    if (text.isEmpty()) {
                        replyControl("{\"type\":\"result\",\"cmd\":\"setClipboard\",\"target\":\"\",\"ok\":false,\"error\":\"text 参数为空\"}")
                    } else {
                        mainHandler.post {
                            val err = try {
                                val cm = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                cm.setPrimaryClip(android.content.ClipData.newPlainText("lb", text))
                                null
                            } catch (e: Exception) {
                                "写入剪贴板失败：" + (e.message ?: e.javaClass.simpleName)
                            }
                            val sb = StringBuilder("{\"type\":\"result\",\"cmd\":\"setClipboard\",\"target\":\"\",\"ok\":")
                            sb.append(if (err == null) "true" else "false")
                            if (err != null) sb.append(",\"error\":\"").append(org.json.JSONObject.quote(err).trim('"')).append('"')
                            sb.append('}')
                            replyControl(sb.toString())
                        }
                    }
                }
                "usbDirect" -> {
                    // 1.4.1：PC 侧显式开关 USB 直传（{"cmd":"usbDirect","on":true|false}）。
                    // 回执经 replyControl 双路广播；在 USB 通道读循环线程上到达，post 到主线程执行。
                    val on = obj.optBoolean("on", true)
                    mainHandler.post {
                        if (on) openUsbDirect()
                        else {
                            usbDirectOn = false
                            closeUsbChannel()
                            toastUi("USB 直传已关闭，恢复 Wi-Fi 推流")
                            replyControl("{\"type\":\"usbDirect\",\"ok\":true,\"on\":false}")
                        }
                    }
                }
                "launchApp", "goHome", "wakeScreen" -> {
                    // 三条 App 任务指令与投屏解耦：共享 ControlCommands（MainActivity 轻量通道同源）
                    ControlCommands.handle(this, text) { json -> replyControl(json) }
                }
                "stop" -> mainHandler.post {
                    Toast.makeText(this, "查看器请求停止投屏", Toast.LENGTH_SHORT).show()
                    shutdownLocked()
                    stopSelf()
                }
            }
        } catch (_: Exception) {
            // 非法 JSON 忽略
        }
    }

    /**
     * v1.4.0 屏幕信息快照（screenInfo 应答与 screenChanged 广播共用一份字段）：
     * realWidth/realHeight 是「当前方向」真实显示分辨率（旋转后宽高已互换），与推流帧同方向，
     * 客户端按 手机坐标 = 帧坐标 × realWidth/frameWidth 直接换算。id 仅供请求回显认领，
     * 请求不带时省略；screenChanged 恒不带 id。投屏会话不在（screenStream 为空）返回 null 不回包。
     */
    private fun screenInfoJson(type: String, id: String?): String? {
        val stream = screenStream ?: return null
        val sb = StringBuilder()
        sb.append("{\"type\":\"").append(type).append("\"")
        if (!id.isNullOrEmpty()) sb.append(",\"id\":").append(org.json.JSONObject.quote(id))
        sb.append(",\"realWidth\":").append(stream.realWidth())
        sb.append(",\"realHeight\":").append(stream.realHeight())
        sb.append(",\"frameWidth\":").append(stream.frameWidth.get())
        sb.append(",\"frameHeight\":").append(stream.frameHeight.get())
        sb.append(",\"scale\":").append(stream.scale)
        sb.append(",\"orientation\":").append(stream.orientationDegrees())
        sb.append(",\"quality\":").append(stream.quality)
        sb.append("}")
        return sb.toString()
    }

    /** 虚拟屏因旋转或档位变化重建后调用：向所有已连接客户端广播 screenChanged。
     *  旧查看器（v1.3.x）收到后按未知文本消息忽略，无害。 */
    private fun broadcastScreenChanged() {
        try {
            screenInfoJson("screenChanged", null)?.let { replyControl(it) }
        } catch (_: Exception) {
        }
    }

    /**
     * 1.2.1：控制回执统一出口。v1.2.0 只回 USB 通道（usbChannel?.sendControlJson），
     * 经 WS 下发的指令在 usbChannel 为空时回执被静默丢弃（PC 侧收不到 ok:false）。
     * 现在双路回执：USB 在回 USB，WS 在也同步广播给 WS 客户端。
     */
    private fun replyControl(json: String) {
        usbChannel?.sendControlJson(json)
        server?.broadcastText(json)
    }

    private val mainHandler by lazy { android.os.Handler(mainLooper) }

    fun applySettings(scale: Float?, quality: Int?) {
        quality?.let { screenStream?.quality = it }
        scale?.let { screenStream?.applyScale(it) }
    }

    private fun shutdownLocked() {
        running = false
        if (instance === this) instance = null
        // 下线信标先行（异步单线程尽力而为）：PC 端收到后立即释放槽位，不等 10 秒心跳超时
        try { beacon?.stop() } catch (_: Exception) {}
        beacon = null
        try {
            usbReceiver?.let { unregisterReceiver(it) }
        } catch (_: Exception) {}
        usbReceiver = null
        try { unregisterReceiver(usbPermissionReceiver) } catch (_: Exception) {}
        usbChannel?.close()
        usbChannel = null
        usbDirectOn = false
        try { heartbeatThread?.interrupt() } catch (_: Exception) {}
        heartbeatThread = null
        try { envMonitor?.stop() } catch (_: Exception) {}
        envMonitor = null
        try { screenStream?.stop() } catch (_: Exception) {}
        screenStream = null
        try { server?.stop() } catch (_: Exception) {}
        server = null
        clientCount = 0
        lastFps = 0
    }

    override fun onDestroy() {
        shutdownLocked()
        super.onDestroy()
    }
}

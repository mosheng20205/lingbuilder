package com.lingbuilder.companion

import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.security.MessageDigest
import java.util.Collections
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.concurrent.thread

/**
 * 极简 RFC 6455 WebSocket 服务端（本仓库手写实现，零第三方依赖）。
 *
 * 能力边界（按投屏伴侣的需要裁剪）：
 * - 只支持明文 ws://（局域网内使用，配对码做访问控制）。
 * - 握手后二进制/文本帧双向；客户端帧必须带掩码（RFC 要求，浏览器与常规客户端都遵守）。
 * - 服务端出帧不加掩码；消息不分片发送（单帧即可，JPEG 单帧远小于上限）。
 * - 收到 ping 回 pong；收到 close 回 close；忽略未知操作码。
 */
class WsServer(
    private val port: Int,
    private val tokenProvider: () -> String,
    private val onClientConnected: (WsClient) -> Unit,
    private val onClientDisconnected: (WsClient) -> Unit,
    private val onTextMessage: (WsClient, String) -> Unit,
) {
    private val running = AtomicBoolean(false)
    private var serverSocket: ServerSocket? = null
    val clients = Collections.synchronizedSet(HashSet<WsClient>())
    val acceptedCount = AtomicLong(0)
    val rejectedCount = AtomicLong(0)

    fun start() {
        if (!running.compareAndSet(false, true)) return
        thread(name = "ws-accept") {
            try {
                ServerSocket(port).let { serverSocket = it }
                while (running.get()) {
                    val socket = try {
                        serverSocket?.accept() ?: break
                    } catch (e: IOException) {
                        break
                    }
                    thread(name = "ws-client") { handleConnection(socket) }
                }
            } catch (e: IOException) {
                // 端口被占用等致命错误：停止服务，让上层 UI 感知
                running.set(false)
            }
        }
    }

    fun stop() {
        running.set(false)
        try {
            serverSocket?.close()
        } catch (_: IOException) {}
        synchronized(clients) {
            clients.toList().forEach { it.closeQuietly() }
            clients.clear()
        }
    }

    fun isRunning(): Boolean = running.get()

    fun broadcastBytes(payload: ByteArray) {
        synchronized(clients) {
            clients.toList().forEach { it.enqueueBinary(payload) }
        }
    }

    fun broadcastText(text: String) {
        synchronized(clients) {
            clients.toList().forEach { it.sendText(text) }
        }
    }

    private fun handleConnection(socket: Socket) {
        socket.soTimeout = 15000
        val input = BufferedInputStream(socket.getInputStream(), 32 * 1024)
        val output = BufferedOutputStream(socket.getOutputStream(), 256 * 1024)
        val request = try {
            readHttpHeader(input)
        } catch (e: IOException) {
            socket.close(); return
        }
        if (request == null) { socket.close(); return }

        val ok = verifyHandshake(request)
        if (!ok) {
            rejectedCount.incrementAndGet()
            try {
                val reason = if (request.line.startsWith("GET /stream")) "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
                else "HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
                output.write(reason.toByteArray(Charsets.US_ASCII))
                output.flush()
            } catch (_: IOException) {}
            socket.close()
            return
        }

        val acceptKey = computeAcceptKey(request.header("Sec-WebSocket-Key") ?: "")
        val response = buildString {
            append("HTTP/1.1 101 Switching Protocols\r\n")
            append("Upgrade: websocket\r\n")
            append("Connection: Upgrade\r\n")
            append("Sec-WebSocket-Accept: ").append(acceptKey).append("\r\n")
            append("\r\n")
        }
        try {
            output.write(response.toByteArray(Charsets.US_ASCII))
            output.flush()
        } catch (e: IOException) {
            socket.close(); return
        }

        acceptedCount.incrementAndGet()
        socket.soTimeout = 0
        val client = WsClient(socket, input, output)
        clients.add(client)
        onClientConnected(client)
        try {
            client.readLoop { text -> onTextMessage(client, text) }
        } finally {
            clients.remove(client)
            onClientDisconnected(client)
            client.closeQuietly()
        }
    }

    private fun verifyHandshake(request: HttpRequest): Boolean {
        if (!request.line.startsWith("GET /stream")) return false
        if ((request.header("Upgrade") ?: "").lowercase() != "websocket") return false
        val connection = request.header("Connection") ?: ""
        if (!connection.lowercase().contains("upgrade")) return false
        if (request.header("Sec-WebSocket-Key").isNullOrBlank()) return false
        val url = request.line.substringAfter("GET ").substringBefore(" HTTP")
        val expected = "/stream?token=" + tokenProvider()
        return url == expected
    }

    private fun readHttpHeader(input: InputStream): HttpRequest? {
        val builder = StringBuilder()
        val buffer = ByteArray(1)
        while (true) {
            val n = input.read(buffer, 0, 1)
            if (n < 0) return null
            builder.append(buffer[0].toInt().toChar())
            if (builder.endsWith("\r\n\r\n")) break
            if (builder.length > 16 * 1024) return null
        }
        val lines = builder.toString().split("\r\n").filter { it.isNotBlank() }
        if (lines.isEmpty()) return null
        val headers = HashMap<String, String>()
        for (i in 1 until lines.size) {
            val idx = lines[i].indexOf(':')
            if (idx <= 0) continue
            headers[lines[i].substring(0, idx).trim().lowercase()] = lines[i].substring(idx + 1).trim()
        }
        return HttpRequest(lines[0], headers)
    }

    private fun computeAcceptKey(clientKey: String): String {
        val magic = clientKey.trim() + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        val digest = MessageDigest.getInstance("SHA-1").digest(magic.toByteArray(Charsets.US_ASCII))
        return android.util.Base64.encodeToString(digest, android.util.Base64.NO_WRAP)
    }
}

class HttpRequest(val line: String, private val headers: Map<String, String>) {
    fun header(name: String): String? = headers[name.lowercase()]
}

/** 一个已握手的 WebSocket 客户端连接。 */
class WsClient(
    private val socket: Socket,
    private val input: InputStream,
    private val output: OutputStream,
) {
    private val writeLock = Any()
    @Volatile var closed = false
        private set
    var tag: String = ""
    val sentBytes = AtomicLong(0)
    val sentFrames = AtomicLong(0)

    // 有界发送队列：视频帧走队列，慢客户端丢帧不阻塞采集线程；控制文本仍同步直写
    private val frameQueue = java.util.concurrent.ArrayBlockingQueue<ByteArray>(3)
    private val writerThread = thread(name = "ws-writer", isDaemon = true) {
        while (!closed) {
            val payload = try { frameQueue.take() } catch (e: InterruptedException) { break }
            if (closed) break
            sendDirect(0x2, payload)
        }
    }

    /** 入队一帧视频；队列满直接丢弃最旧帧（实时流丢帧优于积压）。 */
    fun enqueueBinary(payload: ByteArray) {
        if (closed) return
        while (!frameQueue.offer(payload)) {
            frameQueue.poll()
            droppedCount.incrementAndGet()
            if (closed) return
        }
    }

    val droppedCount = AtomicLong(0)

    /** 阻塞读取客户端帧；文本消息回调给上层，连接结束返回。 */
    fun readLoop(onText: (String) -> Unit) {
        val fragmentation = ByteArrayOutputStream()
        var fragmentationOpcode = -1
        while (!closed) {
            val header = try { readExactly(input, 2) } catch (e: IOException) { break } ?: break
            val fin = (header[0].toInt() and 0x80) != 0
            val opcode = header[0].toInt() and 0x0F
            val masked = (header[1].toInt() and 0x80) != 0
            var length = (header[1].toInt() and 0x7F).toLong()
            if (length == 126L) {
                val ext = try { readExactly(input, 2) } catch (e: IOException) { break } ?: break
                length = ((ext[0].toInt() and 0xFF).toLong() shl 8) or (ext[1].toInt() and 0xFF).toLong()
            } else if (length == 127L) {
                val ext = try { readExactly(input, 8) } catch (e: IOException) { break } ?: break
                length = 0
                for (b in ext) length = (length shl 8) or (b.toInt() and 0xFF).toLong()
            }
            if (length > 1 shl 20) break // 1MB 上限，防异常客户端
            val mask = if (masked) { try { readExactly(input, 4) } catch (e: IOException) { break } ?: break } else null
            val payload = if (length > 0) {
                val data = try { readExactly(input, length.toInt()) } catch (e: IOException) { break } ?: break
                if (mask != null) {
                    for (i in data.indices) data[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte()
                }
                data
            } else ByteArray(0)

            when (opcode) {
                0x0 -> { // continuation
                    fragmentation.write(payload)
                    if (fin) {
                        val data = fragmentation.toByteArray()
                        fragmentation.reset()
                        if (fragmentationOpcode == 0x1) onText(String(data, Charsets.UTF_8))
                        fragmentationOpcode = -1
                    }
                }
                0x1, 0x2 -> { // text / binary
                    if (fin) {
                        if (opcode == 0x1) onText(String(payload, Charsets.UTF_8))
                        // 二进制上行当前协议未使用，忽略
                    } else {
                        fragmentation.reset()
                        fragmentation.write(payload)
                        fragmentationOpcode = opcode
                    }
                }
                0x8 -> { // close
                    sendFrame(0x8, payload.take(2).toByteArray())
                    break
                }
                0x9 -> sendFrame(0xA, payload) // ping -> pong
                0xA -> Unit // pong 忽略
                else -> Unit // 未知操作码忽略
            }
        }
        closed = true
    }

    fun sendText(text: String) = sendFrame(0x1, text.toByteArray(Charsets.UTF_8))

    private fun sendFrame(opcode: Int, payload: ByteArray): Boolean {
        if (opcode == 0x2) return false // 二进制必须走 enqueueBinary
        return sendDirect(opcode, payload)
    }

    private fun sendDirect(opcode: Int, payload: ByteArray): Boolean {
        if (closed) return false
        synchronized(writeLock) {
            if (closed) return false
            return try {
                val header = ArrayList<Byte>(10)
                header.add((0x80 or opcode).toByte())
                when {
                    payload.size < 126 -> header.add(payload.size.toByte())
                    payload.size < 65536 -> {
                        header.add(126.toByte())
                        header.add(((payload.size shr 8) and 0xFF).toByte())
                        header.add((payload.size and 0xFF).toByte())
                    }
                    else -> {
                        header.add(127.toByte())
                        val n = payload.size.toLong()
                        for (shift in 56 downTo 0 step 8) header.add(((n shr shift) and 0xFF).toByte())
                    }
                }
                val headBytes = ByteArray(header.size) { header[it] }
                output.write(headBytes)
                output.write(payload)
                output.flush()
                sentBytes.addAndGet((headBytes.size + payload.size).toLong())
                sentFrames.incrementAndGet()
                true
            } catch (e: IOException) {
                closed = true
                false
            }
        }
    }

    fun closeQuietly() {
        closed = true
        writerThread.interrupt()
        try { socket.close() } catch (_: IOException) {}
    }
}

private fun readExactly(input: InputStream, count: Int): ByteArray? {
    val data = ByteArray(count)
    var offset = 0
    while (offset < count) {
        val n = input.read(data, offset, count - offset)
        if (n < 0) return null
        offset += n
    }
    return data
}

private class ByteArrayOutputStream {
    private val buffer = java.io.ByteArrayOutputStream()
    fun write(data: ByteArray) { buffer.write(data) }
    fun toByteArray(): ByteArray = buffer.toByteArray()
    fun reset() = buffer.reset()
}

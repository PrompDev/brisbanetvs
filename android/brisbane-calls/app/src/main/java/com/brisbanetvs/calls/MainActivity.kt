package com.brisbanetvs.calls

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.graphics.Color
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var secureStore: SecureStore
    private lateinit var root: LinearLayout
    private val state by lazy { getSharedPreferences("brisbane_calls_state", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        secureStore = SecureStore(this)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(24), dp(22), dp(34))
            setBackgroundColor(Color.rgb(244, 241, 234))
        }
        setContentView(ScrollView(this).apply { addView(root) })
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }

    private fun handleIntent(intent: Intent?) {
        val uri = intent?.data
        when {
            intent?.action == Intent.ACTION_SEND -> handleSharedRecording(intent)
            uri?.scheme == "brisbanetvs" && uri.host == "paired" -> exchangePairing(uri.getQueryParameter("code"))
            intent?.action == Intent.ACTION_VIEW && uri?.host == "brisbanetvs.com" -> openCalendarLead(uri)
            else -> showHome()
        }
    }

    private fun showHome(message: String? = null) {
        clearScreen()
        heading("Brisbane Calls")
        body(message ?: "Open a follow-up link in Google Calendar. The app will load the right customer before you call.")
        if (secureStore.token() == null) {
            body("This phone is not paired yet. Pairing connects only this installed app to the private Operations workspace.")
            primaryButton("Pair this phone") {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.API_BASE}/operations/phone/pair/")))
            }
        } else {
            status("Phone paired", true)
            body("After the call, open the recording in the Phone app and choose Share > Brisbane Calls. The upload will be attached to the calendar lead.")
            secondaryButton("Pair again") {
                secureStore.clear()
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.API_BASE}/operations/phone/pair/")))
            }
        }
    }

    private fun exchangePairing(code: String?) {
        if (code.isNullOrBlank()) {
            showHome("The pairing code was missing. Start again from the pairing page.")
            return
        }
        showBusy("Pairing this phone...")
        executor.execute {
            try {
                val connection = connection("/api/mobile-call/pair", "POST").apply {
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    doOutput = true
                }
                val payload = JSONObject()
                    .put("code", code)
                    .put("deviceLabel", "Tom's Pixel")
                    .toString()
                    .toByteArray(Charsets.UTF_8)
                connection.setFixedLengthStreamingMode(payload.size)
                connection.outputStream.use { it.write(payload) }
                val response = readResponse(connection)
                val token = response.optString("token")
                if (connection.responseCode !in 200..299 || token.isBlank()) error("pairing_failed")
                secureStore.saveToken(token)
                runOnUiThread { showHome("Pairing complete. Calendar call links can now open in this app.") }
            } catch (_: Exception) {
                runOnUiThread { showHome("Pairing did not complete. Open the pairing page and create a new code.") }
            }
        }
    }

    private fun openCalendarLead(uri: Uri) {
        val token = secureStore.token()
        if (token == null) {
            showHome("Pair this phone before opening a calendar call.")
            return
        }
        val leadId = uri.getQueryParameter("lead_id")
        val reference = uri.getQueryParameter("ref")
        val source = uri.getQueryParameter("source")
        if (leadId.isNullOrBlank() && reference.isNullOrBlank()) {
            showHome("This calendar link does not contain a lead reference.")
            return
        }
        showBusy("Loading the calendar lead...")
        executor.execute {
            try {
                val query = buildList {
                    if (!leadId.isNullOrBlank()) add("lead_id=${Uri.encode(leadId)}")
                    if (!reference.isNullOrBlank()) add("ref=${Uri.encode(reference)}")
                    if (!source.isNullOrBlank()) add("source=${Uri.encode(source)}")
                }.joinToString("&")
                val connection = connection("/api/mobile-call/lead?$query", "GET").apply {
                    setRequestProperty("Authorization", "Bearer $token")
                }
                val response = readResponse(connection)
                if (connection.responseCode == 401) {
                    secureStore.clear()
                    error("device_not_authorised")
                }
                if (connection.responseCode !in 200..299) error("lead_not_found")
                val lead = response.getJSONObject("lead")
                val loaded = Lead(
                    id = lead.getString("id"),
                    name = lead.optString("name", "Customer"),
                    phone = lead.optString("phone"),
                    service = lead.optString("service"),
                    suburb = lead.optString("suburb"),
                )
                runOnUiThread { showLead(loaded) }
            } catch (_: Exception) {
                runOnUiThread { showHome("The calendar lead could not be loaded. Check the link or pair the phone again.") }
            }
        }
    }

    private fun showLead(lead: Lead) {
        clearScreen()
        eyebrow("Calendar follow-up")
        heading(lead.name.ifBlank { "Customer call" })
        detail("Phone", lead.phone.ifBlank { "No phone number" })
        detail("Service", lead.service.ifBlank { "Not supplied" })
        detail("Area", lead.suburb.ifBlank { "Not supplied" })
        body("Tap Call, then use Phone > Call Assist > Call recording. Google Phone announces the recording to both people.")
        primaryButton("Call & record") {
            if (lead.phone.isBlank()) return@primaryButton
            state.edit()
                .putString("lead_id", lead.id)
                .putString("call_started_at", Instant.now().toString())
                .apply()
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(lead.phone)}")))
        }.isEnabled = lead.phone.isNotBlank()
        body("After the call: open it in Phone history, open the recording, tap Share and choose Brisbane Calls.")
    }

    private fun handleSharedRecording(intent: Intent) {
        val uri = sharedUri(intent)
        val leadId = state.getString("lead_id", null)
        if (uri == null || leadId.isNullOrBlank()) {
            showHome("Open the customer's calendar call link before sharing a recording.")
            return
        }
        val info = recordingInfo(contentResolver, uri)
        clearScreen()
        eyebrow("Recording ready")
        heading("Calendar call recording")
        detail("File", info.name)
        detail("Size", readableSize(info.size))
        body("Confirm that Google Phone played its recording announcement to both people before this audio is uploaded.")
        val disclosure = CheckBox(this).apply {
            text = getString(R.string.recording_announcement_confirmed)
            textSize = 16f
            setTextColor(Color.rgb(36, 55, 68))
            setPadding(0, dp(8), 0, dp(8))
        }
        root.addView(disclosure)
        val upload = primaryButton("Upload to Operations") {
            if (!disclosure.isChecked) {
                disclosure.error = "Confirmation required"
                return@primaryButton
            }
            disclosure.isEnabled = false
            uploadRecording(uri, info)
        }
        upload.isEnabled = info.size in 1..MAX_UPLOAD_BYTES
        if (!upload.isEnabled) status("The recording must be between 1 byte and 100 MB.", false)
    }

    private fun uploadRecording(uri: Uri, info: RecordingInfo) {
        val token = secureStore.token()
        val leadId = state.getString("lead_id", null)
        if (token == null || leadId == null) {
            showHome("Pair the phone and reopen the calendar link before uploading.")
            return
        }
        showBusy("Checking and uploading the recording...")
        executor.execute {
            try {
                val checksum = sha256(uri)
                val duration = recordingDuration(uri)
                val uploadId = UUID.randomUUID().toString()
                val connection = connection("/api/mobile-call/recording", "PUT").apply {
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type", info.contentType)
                    setRequestProperty("X-Lead-Id", leadId)
                    setRequestProperty("X-Upload-Id", uploadId)
                    setRequestProperty("X-File-Name", headerFilename(info.name))
                    setRequestProperty("X-Content-Sha256", checksum)
                    setRequestProperty("X-Consent-Confirmed", "recording-announcement")
                    setRequestProperty("X-Call-Direction", "outbound")
                    setRequestProperty("X-Call-Started-At", state.getString("call_started_at", "") ?: "")
                    setRequestProperty("X-Call-Duration-Seconds", duration.toString())
                    doOutput = true
                    setFixedLengthStreamingMode(info.size)
                }
                contentResolver.openInputStream(uri).use { input ->
                    requireNotNull(input)
                    BufferedInputStream(input).use { source ->
                        BufferedOutputStream(connection.outputStream).use { target -> source.copyTo(target) }
                    }
                }
                val response = readResponse(connection)
                if (connection.responseCode == 401) {
                    secureStore.clear()
                    error("device_not_authorised")
                }
                if (connection.responseCode !in 200..299 || !response.optBoolean("ok")) {
                    error(response.optString("error", "upload_failed"))
                }
                state.edit().remove("lead_id").remove("call_started_at").apply()
                runOnUiThread { showHome("Recording uploaded. It is now attached to the lead in Operations > Calls.") }
            } catch (_: Exception) {
                runOnUiThread { showHome("The recording did not upload. Reopen the calendar link, then share the recording again.") }
            }
        }
    }

    private fun sharedUri(intent: Intent): Uri? = if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }

    private fun recordingInfo(resolver: ContentResolver, uri: Uri): RecordingInfo {
        var name = "call-recording.m4a"
        var size = -1L
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = cursor.getString(it) ?: name }
                cursor.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 }?.let { size = cursor.getLong(it) }
            }
        }
        if (size < 0) resolver.openAssetFileDescriptor(uri, "r")?.use { size = it.length }
        val mime = resolver.getType(uri).orEmpty()
        val contentType = when {
            mime.startsWith("audio/") -> mime
            name.endsWith(".mp3", true) -> "audio/mpeg"
            name.endsWith(".wav", true) -> "audio/wav"
            name.endsWith(".ogg", true) -> "audio/ogg"
            name.endsWith(".3gp", true) -> "audio/3gpp"
            else -> "audio/mp4"
        }
        return RecordingInfo(name.take(180), size, contentType)
    }

    private fun recordingDuration(uri: Uri): Int = try {
        val retriever = MediaMetadataRetriever()
        retriever.setDataSource(this, uri)
        val milliseconds = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        retriever.release()
        (milliseconds / 1000L).coerceIn(0L, 86_400L).toInt()
    } catch (_: Exception) {
        0
    }

    private fun sha256(uri: Uri): String {
        val digest = MessageDigest.getInstance("SHA-256")
        contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input)
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun connection(path: String, method: String): HttpURLConnection =
        (URL("${BuildConfig.API_BASE}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20_000
            readTimeout = 120_000
            useCaches = false
            setRequestProperty("Accept", "application/json")
        }

    private fun readResponse(connection: HttpURLConnection): JSONObject {
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText().take(16_384) }.orEmpty()
        return try { JSONObject(text) } catch (_: Exception) { JSONObject() }
    }

    private fun clearScreen() = root.removeAllViews()

    private fun showBusy(message: String) {
        clearScreen()
        heading("Brisbane Calls")
        root.addView(ProgressBar(this).apply {
            isIndeterminate = true
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).apply { gravity = Gravity.CENTER_HORIZONTAL }
        })
        body(message)
    }

    private fun eyebrow(text: String) = root.addView(TextView(this).apply {
        this.text = text.uppercase()
        textSize = 12f
        setTextColor(Color.rgb(177, 77, 52))
        letterSpacing = .12f
    })

    private fun heading(text: String) = root.addView(TextView(this).apply {
        this.text = text
        textSize = 30f
        setTextColor(Color.rgb(32, 55, 68))
        setPadding(0, dp(4), 0, dp(12))
    })

    private fun body(text: String) = root.addView(TextView(this).apply {
        this.text = text
        textSize = 16f
        setTextColor(Color.rgb(83, 101, 112))
        setLineSpacing(0f, 1.25f)
        setPadding(0, dp(5), 0, dp(12))
    })

    private fun detail(label: String, value: String) = root.addView(TextView(this).apply {
        text = getString(R.string.labelled_detail, label, value)
        textSize = 17f
        setTextColor(Color.rgb(36, 55, 68))
        setPadding(0, dp(7), 0, dp(7))
    })

    private fun status(text: String, positive: Boolean) = root.addView(TextView(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(if (positive) Color.rgb(22, 100, 68) else Color.rgb(139, 63, 66))
        setPadding(0, dp(8), 0, dp(8))
    })

    private fun primaryButton(text: String, action: (View) -> Unit): Button = Button(this).apply {
        this.text = text
        textSize = 16f
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(31, 90, 112))
        setPadding(dp(14), dp(8), dp(14), dp(8))
        setOnClickListener { view -> action(view) }
        root.addView(this, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54)).apply {
            topMargin = dp(6)
            bottomMargin = dp(8)
        })
    }

    private fun secondaryButton(text: String, action: (View) -> Unit): Button = primaryButton(text, action).apply {
        setBackgroundColor(Color.rgb(94, 111, 121))
    }

    private fun readableSize(bytes: Long): String = when {
        bytes < 0 -> "Unknown"
        bytes < 1024 -> "$bytes bytes"
        bytes < 1024 * 1024 -> "%.1f KB".format(bytes / 1024.0)
        else -> "%.1f MB".format(bytes / (1024.0 * 1024.0))
    }

    private fun headerFilename(value: String): String = value
        .replace(Regex("[^A-Za-z0-9._ -]+"), "-")
        .replace(Regex("\\s+"), " ")
        .trim()
        .take(180)
        .ifBlank { "call-recording.m4a" }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    data class Lead(val id: String, val name: String, val phone: String, val service: String, val suburb: String)
    data class RecordingInfo(val name: String, val size: Long, val contentType: String)

    companion object {
        const val MAX_UPLOAD_BYTES = 100L * 1024L * 1024L
    }
}

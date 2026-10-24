package com.fitzyracing1.cispaceship

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Polls the test-world feed in a loop, solves each gapped transfer on the phone, and shows lit/dark counts. */
class MainActivity : Activity() {
    @Volatile private var running = false
    private var worker: Thread? = null
    private var lit = 0
    private var dark = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        val url = findViewById<EditText>(R.id.url)
        val toggle = findViewById<Button>(R.id.toggle)
        val prefs = getSharedPreferences("cfg", MODE_PRIVATE)
        url.setText(prefs.getString("url", ""))
        render()
        toggle.setOnClickListener {
            if (running) {
                running = false
                toggle.setText(R.string.start)
            } else {
                val base = url.text.toString().trim().trimEnd('/')
                if (base.isEmpty()) return@setOnClickListener
                prefs.edit().putString("url", base).apply()
                running = true
                toggle.setText(R.string.stop)
                worker = Thread { loop(base) }.also { it.start() }
            }
        }
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }

    private fun loop(base: String) {
        var since = 0
        while (running) {
            try {
                val page = JSONObject(http("$base/feed?since=$since&limit=10", null))
                val transfers = page.getJSONArray("transfers")
                for (i in 0 until transfers.length()) {
                    if (!running) break
                    val t = transfers.getJSONObject(i)
                    val light = try {
                        JSONObject(http("$base/verify", Solver.solve(t).toString())).optString("light", "dark")
                    } catch (e: Exception) {
                        "dark"
                    }
                    if (light == "lit") lit++ else dark++
                    val gaps = t.optJSONArray("gaps")?.join(",") ?: ""
                    runOnUiThread { log("${t.getString("id")} $light $gaps"); render() }
                }
                since = page.getInt("next")
            } catch (e: Exception) {
                runOnUiThread { log("feed error: ${e.javaClass.simpleName}") }
                Thread.sleep(3000)
            }
            Thread.sleep(500)
        }
    }

    private fun render() {
        val light = if (dark == 0 && lit > 0) "LIT" else "DARK"
        findViewById<TextView>(R.id.light).text = "$light · lit $lit · dark $dark"
    }

    private val lines = ArrayDeque<String>()
    private fun log(s: String) {
        lines.addFirst(s)
        while (lines.size > 15) lines.removeLast()
        findViewById<TextView>(R.id.log).text = lines.joinToString("\n")
    }

    private fun http(url: String, body: String?): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 5000
        c.readTimeout = 5000
        if (body != null) {
            c.requestMethod = "POST"
            c.doOutput = true
            c.setRequestProperty("content-type", "application/json")
            c.outputStream.use { it.write(body.toByteArray()) }
        }
        return try { c.inputStream.bufferedReader().use { it.readText() } } finally { c.disconnect() }
    }
}

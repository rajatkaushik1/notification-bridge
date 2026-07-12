package com.callbridge.pro

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private val PERMISSION_REQUEST_CODE = 101

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Programmatic layout for simplicity & zero xml resource dependencies
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(60, 80, 60, 80)
            setBackgroundColor(android.graphics.Color.parseColor("#0a0e1a"))
        }

        val titleText = TextView(this).apply {
            text = "⚡ CallBridge PRO"
            textSize = 28f
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }

        val subTitleText = TextView(this).apply {
            text = "Your Custom Mobile-to-Laptop Bridge App"
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#9ca3af"))
            setPadding(0, 10, 0, 40)
        }

        val prefs = getSharedPreferences("CallBridgePrefs", Context.MODE_PRIVATE)

        val urlInput = EditText(this).apply {
            hint = "Webhook URL"
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.GRAY)
            setText(prefs.getString("webhookUrl", "https://callbridge-pro.rajatrajkaushik1.workers.dev/api/call"))
        }

        val saveBtn = Button(this).apply {
            text = "💾 Save Webhook URL"
            setBackgroundColor(android.graphics.Color.parseColor("#6366f1"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                prefs.edit().putString("webhookUrl", urlInput.text.toString()).apply()
                Toast.makeText(this@MainActivity, "Webhook URL Saved!", Toast.LENGTH_SHORT).show()
            }
        }

        val enableSwitch = Switch(this).apply {
            text = "Active Listening for Incoming Calls"
            setTextColor(android.graphics.Color.WHITE)
            isChecked = prefs.getBoolean("isEnabled", true)
            setPadding(0, 40, 0, 40)
            setOnCheckedChangeListener { _, isChecked ->
                prefs.edit().putBoolean("isEnabled", isChecked).apply()
            }
        }

        val testBtn = Button(this).apply {
            text = "🚀 Send Test Call to Laptop"
            setBackgroundColor(android.graphics.Color.parseColor("#10b981"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                sendTestCall(urlInput.text.toString())
            }
        }

        layout.addView(titleText)
        layout.addView(subTitleText)
        layout.addView(urlInput)
        layout.addView(saveBtn)
        layout.addView(enableSwitch)
        layout.addView(testBtn)

        setContentView(layout)

        checkPermissions()
    }

    private fun checkPermissions() {
        val readPhoneState = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
        val readCallLog = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG)

        if (readPhoneState != PackageManager.PERMISSION_GRANTED || readCallLog != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG),
                PERMISSION_REQUEST_CODE
            )
        }
    }

    private fun sendTestCall(webhookUrl: String) {
        Executors.newSingleThreadExecutor().execute {
            try {
                val url = URL(webhookUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val jsonPayload = JSONObject().apply {
                    put("number", "+91 98765 43210")
                    put("contactName", "Test Call From Custom App")
                    put("status", "Ringing")
                    put("tag", "Important")
                }

                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(jsonPayload.toString())
                    writer.flush()
                }

                val code = conn.responseCode
                runOnUiThread {
                    Toast.makeText(this, "Sent! Server HTTP $code", Toast.LENGTH_SHORT).show()
                }
                conn.disconnect()
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}

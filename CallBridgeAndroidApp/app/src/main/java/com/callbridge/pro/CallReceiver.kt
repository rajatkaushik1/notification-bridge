package com.callbridge.pro

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class CallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            if (state == TelephonyManager.EXTRA_STATE_RINGING) {
                val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Unknown Number"
                Log.d("CallBridgePro", "Incoming call detected from: $incomingNumber")

                val prefs = context.getSharedPreferences("CallBridgePrefs", Context.MODE_PRIVATE)
                val isEnabled = prefs.getBoolean("isEnabled", true)
                val webhookUrl = prefs.getString("webhookUrl", "https://callbridge-pro.rajatrajkaushik1.workers.dev/api/call")

                if (isEnabled && !webhookUrl.isNullOrEmpty()) {
                    sendWebhookNotification(webhookUrl, incomingNumber)
                }
            }
        }
    }

    private fun sendWebhookNotification(urlStr: String, callerNumber: String) {
        Executors.newSingleThreadExecutor().execute {
            try {
                val url = URL(urlStr)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val jsonPayload = JSONObject().apply {
                    put("number", callerNumber)
                    put("contactName", "Mobile Call ($callerNumber)")
                    put("status", "Ringing")
                    put("tag", "General")
                }

                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(jsonPayload.toString())
                    writer.flush()
                }

                val responseCode = conn.responseCode
                Log.d("CallBridgePro", "Webhook sent! Response code: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e("CallBridgePro", "Error sending webhook: ${e.message}")
            }
        }
    }
}

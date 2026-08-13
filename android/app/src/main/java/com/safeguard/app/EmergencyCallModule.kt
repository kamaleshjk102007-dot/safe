package com.safeguard.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class EmergencyCallModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "EmergencyCall"

  @ReactMethod
  fun callNumber(rawNumber: String, promise: Promise) {
    val number = rawNumber.filter { it.isDigit() || it == '+' }
    if (number.isBlank()) {
      promise.reject("INVALID_NUMBER", "Emergency contact has no valid phone number")
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("CALL_PERMISSION", "Phone-call permission is not granted")
      return
    }
    try {
      val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("CALL_FAILED", error.message, error)
    }
  }
}

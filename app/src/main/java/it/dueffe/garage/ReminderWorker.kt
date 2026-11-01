package it.dueffe.garage

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = runCatching {
        val repo = GarageRepository(applicationContext)
        if (!repo.notificationsEnabled) return@runCatching Result.success()
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return@runCatching Result.success()
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("garage_reminders", "Scadenze garage", NotificationManager.IMPORTANCE_DEFAULT))
        val prefs = applicationContext.getSharedPreferences("notified_reminders", Context.MODE_PRIVATE)
        // Server mode: the deadlines come from the Garage server; the local copy is refreshed first.
        runBlocking { repo.refreshFromServer() }
        dueReminders(repo.snapshot()).forEach { item ->
            val relevant = item.days?.let { it in 0..repo.notificationLeadDays.toLong() } == true || item.kmLeft?.let { it <= 0 } == true
            val key = "${item.reminder.dueDate}:${item.reminder.mileageThreshold}:${item.reminder.updatedAt}"
            if (relevant && prefs.getString(item.reminder.id, null) != key) {
                val intent = PendingIntent.getActivity(applicationContext, item.reminder.id.hashCode(), Intent(applicationContext, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val text = if (item.kmLeft != null && item.kmLeft <= 0) "Soglia chilometrica raggiunta" else if (item.days == 0L) "Scade oggi" else "Tra ${item.days} giorni"
                manager.notify(item.reminder.id.hashCode(), NotificationCompat.Builder(applicationContext, "garage_reminders")
                    .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("${item.vehicle.name} · ${maintenanceLabel(item.maintenance)}")
                    .setContentText(text).setContentIntent(intent).setAutoCancel(true).build())
                prefs.edit().putString(item.reminder.id, key).apply()
            }
        }
        Result.success()
    }.getOrElse { Result.retry() }
}

fun scheduleReminders(context: Context, enabled: Boolean) {
    val work = WorkManager.getInstance(context)
    if (enabled) work.enqueueUniquePeriodicWork("dueffe-garage-reminders", ExistingPeriodicWorkPolicy.UPDATE, PeriodicWorkRequestBuilder<ReminderWorker>(1, TimeUnit.DAYS).build())
    else work.cancelUniqueWork("dueffe-garage-reminders")
}

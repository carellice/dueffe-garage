package it.dueffe.garage

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.view.View
import android.widget.RemoteViews

class GarageWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { manager.updateAppWidget(it, buildViews(context, it)) }
    }

    internal fun buildViews(context: Context, widgetId: Int): RemoteViews {
        val repo = GarageRepository(context)
        val upcoming = dueReminders(repo.snapshot()).take(3)
            val theme = repo.theme
            val dark = when (theme) {
                "dark" -> true
                "light" -> false
                else -> context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
            }
            val views = RemoteViews(context.packageName, R.layout.garage_deadlines_widget)
            val primary = if (dark) Color.rgb(255, 215, 117) else Color.rgb(121, 86, 0)
            val foreground = if (dark) Color.rgb(247, 241, 226) else Color.rgb(10, 9, 7)
            val secondary = if (dark) Color.rgb(190, 178, 151) else Color.rgb(102, 91, 70)
            if (theme != "system") {
                views.setInt(R.id.widget_root, "setBackgroundResource", if (dark) R.drawable.widget_background_dark else R.drawable.widget_background_light)
                views.setTextColor(R.id.widget_brand, primary)
                views.setTextColor(R.id.widget_heading, foreground)
                views.setTextColor(R.id.widget_subtitle, secondary)
            }
            val intent = Intent(context, MainActivity::class.java).putExtra("open_page", "scadenze")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, widgetId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            views.setTextViewText(R.id.widget_subtitle,
                if (upcoming.isEmpty()) "Nessuna scadenza in programma" else "Le prossime scadenze delle tue auto")
            val rows = intArrayOf(R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3)
            val icons = intArrayOf(R.id.widget_icon_1, R.id.widget_icon_2, R.id.widget_icon_3)
            val titles = intArrayOf(R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3)
            val details = intArrayOf(R.id.widget_detail_1, R.id.widget_detail_2, R.id.widget_detail_3)
            val statuses = intArrayOf(R.id.widget_status_1, R.id.widget_status_2, R.id.widget_status_3)
            rows.forEachIndexed { index, rowId ->
                if (theme != "system") {
                    views.setInt(rowId, "setBackgroundResource", if (dark) R.drawable.widget_card_background_dark else R.drawable.widget_card_background_light)
                    views.setInt(icons[index], "setBackgroundResource", if (dark) R.drawable.widget_icon_background_dark else R.drawable.widget_icon_background_light)
                    views.setTextColor(titles[index], foreground)
                    views.setTextColor(details[index], secondary)
                }
                val item = upcoming.getOrNull(index)
                views.setViewVisibility(rowId, if (item == null) View.GONE else View.VISIBLE)
                if (item != null) {
                    val (icon, lightTint, darkTint) = when (item.maintenance.type) {
                        "service" -> Triple(R.drawable.ic_wrench, Color.rgb(16, 64, 94), Color.rgb(129, 205, 236))
                        "inspection" -> Triple(R.drawable.ic_settings_nav, Color.rgb(19, 90, 53), Color.rgb(139, 224, 162))
                        "tax" -> Triple(R.drawable.ic_receipt, Color.rgb(159, 74, 9), Color.rgb(255, 186, 117))
                        "insurance" -> Triple(R.drawable.ic_shield, Color.rgb(139, 91, 0), Color.rgb(255, 215, 117))
                        "tires" -> Triple(R.drawable.ic_tire, Color.rgb(100, 35, 117), Color.rgb(219, 162, 235))
                        else -> Triple(R.drawable.ic_note, Color.rgb(110, 80, 20), Color.rgb(228, 197, 133))
                    }
                    views.setImageViewResource(icons[index], icon)
                    if (theme == "system" && Build.VERSION.SDK_INT >= 31) {
                        views.setColorInt(icons[index], "setColorFilter", lightTint, darkTint)
                    } else {
                        views.setInt(icons[index], "setColorFilter", if (dark) darkTint else lightTint)
                    }
                    views.setTextViewText(titles[index], "${maintenanceLabel(item.maintenance)} · ${item.vehicle.name}")
                    views.setTextViewText(details[index], reminderDueDate(item).takeIf(String::isNotBlank)?.let(::dateLabel)
                        ?: item.reminder.mileageThreshold?.formatKm() ?: "Data da verificare")
                    views.setTextViewText(statuses[index], when {
                        item.days == null && item.kmLeft != null && item.kmLeft <= 0 -> "Da fare"
                        item.days == null && item.kmLeft != null -> "${item.kmLeft} km"
                        item.days == null -> "Da verificare"
                        item.days < 0 -> "Scaduta"
                        item.days == 0L -> "Oggi"
                        item.days == 1L -> "1 giorno"
                        else -> "${item.days} giorni"
                    })
                    if ((item.days ?: 999) < 0) {
                        if (theme == "system" && Build.VERSION.SDK_INT >= 31) {
                            views.setColorInt(statuses[index], "setTextColor", Color.rgb(179, 38, 30), Color.rgb(255, 138, 128))
                        } else {
                            views.setTextColor(statuses[index], if (dark) Color.rgb(255, 138, 128) else Color.rgb(179, 38, 30))
                        }
                    } else if (theme != "system") {
                        views.setTextColor(statuses[index], primary)
                    }
                }
            }
            return views
    }

    companion object {
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GarageWidget::class.java))
            if (ids.isNotEmpty()) GarageWidget().onUpdate(context, manager, ids)
        }
    }
}

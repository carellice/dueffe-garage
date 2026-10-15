package it.dueffe.garage

import android.content.res.Configuration
import android.graphics.drawable.GradientDrawable
import android.view.View
import android.widget.TextView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WidgetLayoutTest {
    @Test fun systemThemeWidgetChangesWhenSameRemoteViewsIsReapplied() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val repo = GarageRepository(context)
        val previousTheme = repo.theme
        try {
            repo.theme = "system"
            fun themedContext(night: Boolean) = context.createConfigurationContext(Configuration(context.resources.configuration).apply {
                uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
                    (if (night) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO)
            })
            val remoteViews = GarageWidget().buildViews(themedContext(false), 54322)
            val light = remoteViews.apply(themedContext(false), null)
            val dark = remoteViews.apply(themedContext(true), null)
            assertTrue(light.findViewById<TextView>(R.id.widget_heading).currentTextColor !=
                dark.findViewById<TextView>(R.id.widget_heading).currentTextColor)
            val lightBackground = (light.background as GradientDrawable).color!!.defaultColor
            val darkBackground = (dark.background as GradientDrawable).color!!.defaultColor
            assertTrue(lightBackground != darkBackground)
        } finally {
            repo.theme = previousTheme
        }
    }

    @Test fun widgetShowsUpcomingDeadlineEvenWhenProtected() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val repo = GarageRepository(context)
        val originalBackup = repo.exportBackup()
        val oldProtection = repo.protectionEnabled
        try {
            repo.clear()
            repo.protectionEnabled = false
            val vehicle = Vehicle(name = "Auto di prova", make = "Fiat", plate = "AB123CD")
            repo.save(vehicle)
            val maintenance = Maintenance(vehicleId = vehicle.id, type = "service", date = "2026-09-01")
            repo.save(maintenance, Reminder(maintenanceId = maintenance.id, type = "date", dueDate = "2026-12-01"))
            val visible = GarageWidget().buildViews(context, 54321).apply(context, null)
            assertEquals(View.VISIBLE, visible.findViewById<View>(R.id.widget_row_1).visibility)
            assertTrue(visible.findViewById<TextView>(R.id.widget_title_1).text.contains("Auto di prova"))
            repo.protectionEnabled = true
            val protected = GarageWidget().buildViews(context, 54321).apply(context, null)
            assertEquals(View.VISIBLE, protected.findViewById<View>(R.id.widget_row_1).visibility)
            assertTrue(protected.findViewById<TextView>(R.id.widget_title_1).text.contains("Auto di prova"))
            assertTrue(protected.findViewById<TextView>(R.id.widget_subtitle).text.contains("prossime scadenze"))
        } finally {
            repo.importBackup(originalBackup)
            repo.protectionEnabled = oldProtection
        }
    }
}

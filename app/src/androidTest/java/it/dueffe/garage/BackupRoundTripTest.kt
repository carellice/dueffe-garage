package it.dueffe.garage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BackupRoundTripTest {
    @Test fun pwaBackupRoundTripAndInvalidImportKeepsData() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val repo = GarageRepository(context)
        val before = repo.exportBackup()
        try {
            repo.clear()
            val vehicle = Vehicle(name = "Giulia", make = "Alfa Romeo", plate = "AB123CD", photo = byteArrayOf(1, 2, 3), status = "sold", statusDate = "2026-09-01", fuel = "Benzina/GPL", vehicleType = "motorcycle")
            repo.save(vehicle)
            val maintenance = Maintenance(vehicleId = vehicle.id, type = "service", date = "2026-01-01", mileage = 10000, cost = 119.5)
            repo.save(maintenance, Reminder(maintenanceId = maintenance.id, type = "interval", dueDate = "2027-01-01", intervalValue = 1, intervalUnit = "years"))
            repo.save(GarageDocument(vehicleId = vehicle.id, name = "Libretto", mimeType = "application/pdf", category = "pdf", size = 4, data = byteArrayOf(4, 5, 6, 7)))
            val backup = repo.exportBackup()
            assertEquals("Garage", org.json.JSONObject(String(backup)).getString("product"))
            assertEquals("Benzina/GPL", org.json.JSONObject(String(backup)).getJSONObject("data").getJSONArray("vehicles").getJSONObject(0).getString("fuel"))
            repo.clear()
            repo.importBackup(backup)
            val restored = repo.snapshot()
            assertEquals(1, restored.vehicles.size)
            assertEquals("sold", restored.vehicles.single().status)
            assertEquals("Benzina/GPL", restored.vehicles.single().fuel)
            assertEquals("motorcycle", restored.vehicles.single().vehicleType)
            assertArrayEquals(byteArrayOf(1, 2, 3), restored.vehicles.single().photo)
            assertEquals(119.5, restored.maintenances.single().cost, 0.001)
            assertEquals(1, restored.reminders.size)
            assertArrayEquals(byteArrayOf(4, 5, 6, 7), restored.documents.single().data)
            repo.save(restored.vehicles.single().copy(fuel = "Elettrica"))
            assertEquals("Elettrica", repo.snapshot().vehicles.single().fuel)
            val legacy = org.json.JSONObject(String(backup)).put("product", "Dueffe Garage").apply {
                getJSONObject("data").getJSONArray("vehicles").getJSONObject(0).apply { remove("fuel"); remove("vehicleType") }
            }.toString().toByteArray()
            repo.clear()
            repo.importBackup(legacy)
            assertEquals("Giulia", repo.snapshot().vehicles.single().name)
            assertEquals("", repo.snapshot().vehicles.single().fuel)
            assertEquals("car", repo.snapshot().vehicles.single().vehicleType)
            val invalid = org.json.JSONObject(String(backup)).apply { getJSONObject("data").getJSONArray("maintenances").getJSONObject(0).put("vehicleId", "missing") }.toString().toByteArray()
            assertThrows(IllegalArgumentException::class.java) { repo.importBackup(invalid) }
            assertEquals(1, repo.snapshot().vehicles.size)
        } finally {
            repo.importBackup(before)
        }
    }
    @Test fun pinIsVerifiedWithoutSavingPlainText() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val repo = GarageRepository(context)
        val preferences = context.getSharedPreferences("garage_preferences", android.content.Context.MODE_PRIVATE)
        val oldSalt = preferences.getString("pinSalt", null)
        val oldHash = preferences.getString("pinHash", null)
        try {
            repo.setPin("482739")
            assertTrue(repo.hasPin)
            assertTrue(repo.verifyPin("482739"))
            assertFalse(repo.verifyPin("482738"))
            assertFalse(preferences.getString("pinHash", "")!!.contains("482739"))
        } finally {
            preferences.edit().apply {
                if (oldSalt == null) remove("pinSalt") else putString("pinSalt", oldSalt)
                if (oldHash == null) remove("pinHash") else putString("pinHash", oldHash)
            }.commit()
        }
    }
}

package com.fitzyracing1.cispaceship

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.roundToLong

/** Kotlin port of solver/solve.mjs. Fills the gaps in one transfer; never sees ground truth. */
object Solver {
    val PHASES = listOf("launch", "ascent", "orbit-insertion", "cruise", "landing")
    val FIELDS = listOf("altitude", "velocity", "fuel", "heading")
    private val W = mapOf("altitude" to 1L, "velocity" to 3L, "fuel" to 7L, "heading" to 11L)
    private val SI = mapOf("altitude" to "m", "velocity" to "m/s", "fuel" to "kg", "heading" to "deg")

    private fun toSi(field: String, unit: String, v: Double): Double = when ("$field:$unit") {
        "altitude:m", "velocity:m/s", "fuel:kg", "heading:deg" -> v
        "altitude:km" -> v * 1000
        "velocity:km/h" -> v / 3.6
        "fuel:lb" -> v / 2.20462
        "heading:rad" -> v * 180 / PI
        else -> throw IllegalArgumentException("unknown unit $unit for $field")
    }

    fun solve(t: JSONObject): JSONObject {
        val inState = t.getJSONObject("state")
        val units = t.optJSONObject("units") ?: JSONObject()
        val state = mutableMapOf<String, Long?>()
        for (f in FIELDS) {
            state[f] = if (inState.isNull(f)) null
            else toSi(f, units.optString(f, SI.getValue(f)), inState.getDouble(f)).roundToLong()
        }
        val missing = FIELDS.filter { state[it] == null }
        require(missing.size <= 1) { "unsolvable: ${missing.size} fields missing" }
        missing.firstOrNull()?.let { f ->
            val rest = FIELDS.filter { it != f }.sumOf { W.getValue(it) * state.getValue(it)!! }
            state[f] = (t.getLong("checksum") - rest) / W.getValue(f)
        }
        val from = t.getString("from")
        val to = if (t.isNull("to")) PHASES[(PHASES.indexOf(from) + 1) % PHASES.size] else t.getString("to")
        val inPackets = t.getJSONArray("packets")
        val packets = (0 until inPackets.length()).map { inPackets.getJSONObject(it) }.sortedBy { it.getInt("i") }
        return JSONObject().apply {
            put("id", t.getString("id"))
            put("seq", t.getInt("seq"))
            put("from", from)
            put("to", to)
            put("state", JSONObject().apply { FIELDS.forEach { put(it, state.getValue(it)) } })
            put("units", JSONObject(SI as Map<*, *>))
            put("checksum", FIELDS.sumOf { W.getValue(it) * state.getValue(it)!! })
            put("packets", JSONArray().apply {
                packets.forEach { put(JSONObject().put("i", it.getInt("i")).put("data", it.getString("data"))) }
            })
        }
    }
}

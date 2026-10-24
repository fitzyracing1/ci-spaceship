package com.fitzyracing1.cispaceship

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class SolverTest {
    private fun gapped() = JSONObject(
        """{"id":"s1-t0","seq":0,"from":"cruise","to":null,
        "state":{"altitude":12.345,"velocity":null,"fuel":2204.62,"heading":3.141592653589793},
        "units":{"altitude":"km","velocity":"m/s","fuel":"lb","heading":"rad"},
        "checksum":${12345 + 3 * 7000 + 7 * 1000 + 11 * 180},
        "packets":[{"i":2,"data":"c"},{"i":0,"data":"a"},{"i":1,"data":"b"}]}"""
    )

    @Test fun fillsEveryGap() {
        val s = Solver.solve(gapped())
        val st = s.getJSONObject("state")
        assertEquals(12345L, st.getLong("altitude"))
        assertEquals(7000L, st.getLong("velocity"))
        assertEquals(1000L, st.getLong("fuel"))
        assertEquals(180L, st.getLong("heading"))
        assertEquals("landing", s.getString("to"))
        assertEquals("m", s.getJSONObject("units").getString("altitude"))
        assertEquals("a", s.getJSONArray("packets").getJSONObject(0).getString("data"))
        assertEquals(12345L + 21000 + 7000 + 1980, s.getLong("checksum"))
    }
}

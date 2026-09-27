package com.autumn.player;

import com.getcapacitor.Plugin;
import com.getcapacitor.BridgeActivity;
import com.gokadzev.capacitormusiccontrols.CapacitorMusicControls;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(android.os.Bundle savedInstanceState) {
		registerPlugin(AutumnMediaPlugin.class);
		registerPlugin(CapacitorMusicControls.class);
		super.onCreate(savedInstanceState);
	}
}
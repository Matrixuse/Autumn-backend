package com.autumn.player;

import com.getcapacitor.Plugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(android.os.Bundle savedInstanceState) {
		registerPlugin(AutumnMediaPlugin.class);
		super.onCreate(savedInstanceState);
	}
}

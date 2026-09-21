package com.autumn.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AutumnMedia")
public class AutumnMediaPlugin extends Plugin {
    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("action", intent.getStringExtra(AutumnMediaService.EXTRA_ACTION));
                notifyListeners("mediaAction", data);
            }
        };
        IntentFilter filter = new IntentFilter(AutumnMediaService.ACTION_MEDIA_CONTROL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(actionReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (actionReceiver != null) getContext().unregisterReceiver(actionReceiver);
        super.handleOnDestroy();
    }

    @com.getcapacitor.PluginMethod
    public void updateTrack(PluginCall call) {
        Intent intent = new Intent(getContext(), AutumnMediaService.class)
            .setAction(AutumnMediaService.ACTION_UPDATE)
            .putExtra(AutumnMediaService.EXTRA_ID, call.getString("id", ""))
            .putExtra(AutumnMediaService.EXTRA_TITLE, call.getString("title", "Autumn"))
            .putExtra(AutumnMediaService.EXTRA_ARTIST, call.getString("artist", "Autumn Player"))
            .putExtra(AutumnMediaService.EXTRA_ALBUM, call.getString("album", "Autumn"))
            .putExtra(AutumnMediaService.EXTRA_ARTWORK, call.getString("artwork", ""))
            .putExtra(AutumnMediaService.EXTRA_PLAYING, call.getBoolean("isPlaying", false));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @com.getcapacitor.PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AutumnMediaService.class));
        call.resolve();
    }
}

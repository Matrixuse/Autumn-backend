package com.autumn.player;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class AutumnPlayerWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (AutumnMediaService.ACTION_PLAY.equals(action) || AutumnMediaService.ACTION_PAUSE.equals(action) || AutumnMediaService.ACTION_NEXT.equals(action) || AutumnMediaService.ACTION_PREVIOUS.equals(action)) {
            androidx.core.content.ContextCompat.startForegroundService(context, new Intent(context, AutumnMediaService.class).setAction(action));
        }
    }

    private void update(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.autumn_player_widget);
        views.setOnClickPendingIntent(R.id.widget_previous, control(context, AutumnMediaService.ACTION_PREVIOUS));
        views.setOnClickPendingIntent(R.id.widget_play, control(context, AutumnMediaService.ACTION_PLAY));
        views.setOnClickPendingIntent(R.id.widget_next, control(context, AutumnMediaService.ACTION_NEXT));
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.widget_title, PendingIntent.getActivity(context, 400, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(id, views);
    }

    private PendingIntent control(Context context, String action) {
        Intent intent = new Intent(context, AutumnPlayerWidget.class).setAction(action);
        return PendingIntent.getBroadcast(context, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}

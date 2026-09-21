package com.autumn.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

public class AutumnMediaService extends Service {
    public static final String ACTION_UPDATE = "com.autumn.player.UPDATE";
    public static final String ACTION_STOP = "com.autumn.player.STOP";
    public static final String ACTION_PLAY = "com.autumn.player.PLAY";
    public static final String ACTION_PAUSE = "com.autumn.player.PAUSE";
    public static final String ACTION_NEXT = "com.autumn.player.NEXT";
    public static final String ACTION_PREVIOUS = "com.autumn.player.PREVIOUS";
    public static final String ACTION_MEDIA_CONTROL = "com.autumn.player.MEDIA_CONTROL";
    public static final String EXTRA_ACTION = "action";
    public static final String EXTRA_ID = "id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK = "artwork";
    public static final String EXTRA_PLAYING = "isPlaying";
    private static final String CHANNEL_ID = "autumn_playback";
    private static final int NOTIFICATION_ID = 701;

    private MediaSessionCompat mediaSession;
    private String title = "Autumn";
    private String artist = "Autumn Player";
    private String album = "Autumn";
    private boolean isPlaying;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        mediaSession = new MediaSessionCompat(this, "AutumnMedia");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { sendControl(ACTION_PLAY); }
            @Override public void onPause() { sendControl(ACTION_PAUSE); }
            @Override public void onSkipToNext() { sendControl(ACTION_NEXT); }
            @Override public void onSkipToPrevious() { sendControl(ACTION_PREVIOUS); }
            @Override public void onStop() { sendControl(ACTION_STOP); stopSelf(); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_UPDATE.equals(action)) {
                title = intent.getStringExtra(EXTRA_TITLE, "Autumn");
                artist = intent.getStringExtra(EXTRA_ARTIST, "Autumn Player");
                album = intent.getStringExtra(EXTRA_ALBUM, "Autumn");
                isPlaying = intent.getBooleanExtra(EXTRA_PLAYING, false);
                updatePlaybackState();
            } else if (ACTION_PLAY.equals(action) || ACTION_PAUSE.equals(action) || ACTION_NEXT.equals(action) || ACTION_PREVIOUS.equals(action)) {
                sendControl(action);
            } else if (ACTION_STOP.equals(action)) {
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    private void updatePlaybackState() {
        mediaSession.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .build());
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_STOP)
            .setState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build());
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = PendingIntent.getActivity(this, 10, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(action(ACTION_PREVIOUS, android.R.drawable.ic_media_previous, "Previous"))
            .addAction(action(isPlaying ? ACTION_PAUSE : ACTION_PLAY, isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, isPlaying ? "Pause" : "Play"))
            .addAction(action(ACTION_NEXT, android.R.drawable.ic_media_next, "Next"))
            .setStyle(new MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .build();
    }

    private NotificationCompat.Action action(String action, int icon, String title) {
        Intent intent = new Intent(this, AutumnMediaService.class).setAction(action);
        PendingIntent pendingIntent = PendingIntent.getService(this, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Action.Builder(icon, title, pendingIntent).build();
    }

    private void sendControl(String action) {
        Intent intent = new Intent(ACTION_MEDIA_CONTROL).setPackage(getPackageName()).putExtra(EXTRA_ACTION, action);
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Autumn music playback controls");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}

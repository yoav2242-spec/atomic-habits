package com.yoav.atomic;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.AlarmClock;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;

/**
 * The few things a website cannot do on a phone: ask the Clock app for an alarm and the Calendar app
 * for a repeating event. Both open the other app with everything filled in; nothing is saved silently.
 */
@CapacitorPlugin(name = "AtomicNative")
public class AtomicNativePlugin extends Plugin {

    /** setAlarm({ hour, minutes, message, days }): days are 1 = Sunday ... 7 = Saturday; empty or missing = rings once. */
    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minutes = call.getInt("minutes");
        if (hour == null || minutes == null) {
            call.reject("Missing hour or minutes");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minutes)
            .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("message", ""))
            // Show the Clock app so you can see the alarm that was made.
            .putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        JSArray days = call.getArray("days");
        if (days != null && days.length() > 0) {
            ArrayList<Integer> list = new ArrayList<>();
            try {
                for (int i = 0; i < days.length(); i++) {
                    int d = days.getInt(i);
                    if (d >= 1 && d <= 7 && !list.contains(d)) list.add(d);
                }
            } catch (JSONException e) {
                call.reject("Bad days list");
                return;
            }
            if (!list.isEmpty()) intent.putExtra(AlarmClock.EXTRA_DAYS, list);
        }

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No Clock app can set an alarm on this phone");
        }
    }

    /** addCalendarEvent({ title, startMillis, durationMinutes, rrule }): opens the Calendar's new-event screen, filled in. */
    @PluginMethod
    public void addCalendarEvent(PluginCall call) {
        Double start = call.getDouble("startMillis");
        if (start == null) {
            call.reject("Missing start time");
            return;
        }
        int duration = call.getInt("durationMinutes", 15);
        long startMillis = start.longValue();
        Intent intent = new Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, call.getString("title", ""))
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, startMillis + duration * 60_000L)
            .putExtra(CalendarContract.Events.HAS_ALARM, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        String rrule = call.getString("rrule");
        if (rrule != null && !rrule.isEmpty()) intent.putExtra(CalendarContract.Events.RRULE, rrule);

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No Calendar app on this phone");
        }
    }

    /** Lets the web page know it is running inside the Android app. */
    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("app", true);
        call.resolve(ret);
    }
}

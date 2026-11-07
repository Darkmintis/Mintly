// Mintly — Flutter helper (copy into lib/mintly.dart or wrap as a package).
// No permissions, no cookies, no IDs: only aggregate counts leave the device.
//
// Configure at build time, so keys never live in source:
//   flutter run --dart-define=MINTLY_URL=https://mintly.example.workers.dev \
//               --dart-define=MINTLY_KEY=mk_your_public_key
//
// Usage:
//   Mintly.click('home.red_button');
//   Mintly.appOpen();

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class Mintly {
  Mintly._();

  static const String url = String.fromEnvironment(
    'MINTLY_URL',
    defaultValue: 'https://mintly.example.workers.dev',
  );
  static const String key = String.fromEnvironment(
    'MINTLY_KEY',
    defaultValue: '',
  );
  static const bool enabled = true;

  /// Track any event. dim1 is usually the button/screen id, dim2 the platform.
  static Future<void> event(
    String event, {
    String dim1 = '',
    String dim2 = '',
    int count = 1,
  }) async {
    if (!enabled || key.isEmpty) return;
    try {
      await http
          .post(
            Uri.parse('$url/v1/event'),
            headers: const {
              'Content-Type': 'application/json',
              'X-App-Key': key,
            },
            body: jsonEncode({
              'event': event,
              'dim1': dim1,
              'dim2': dim2,
              'count': count,
            }),
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {
      // Best-effort: analytics must never block or break the UI.
    }
  }

  /// A button tap. The id is your stable label, e.g. "home.red_button".
  static void click(String button, {String platform = 'android'}) {
    unawaited(event('ui_click', dim1: button, dim2: platform));
  }

  /// Call once per cold start.
  static void appOpen({String platform = 'android'}) {
    unawaited(event('app_open', dim2: platform));
  }
}

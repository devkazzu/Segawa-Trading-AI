package com.segawa.tradeai;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Segawa TradeAI Android shell.
 * The web app owns routing, state and analytics; this class only hardens the
 * WebView and lets Capacitor plugins (status bar, keyboard, splash) attach.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setJavaScriptEnabled(true);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setTextZoom(100);      // respect the user's system font scale instead of the page's
            settings.setMediaPlaybackRequiresUserGesture(true);
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            // Layout change on keyboard open is handled by adjustResize + Capacitor Keyboard plugin.
            webView.setVerticalScrollBarEnabled(false);
        }
    }
}

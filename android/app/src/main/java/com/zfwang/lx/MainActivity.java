package com.zfwang.lx;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/**
 * WebView 壳：将 android/app/src/main/assets 下同步的静态 Web 应用
 * （app.html + src/）通过 WebViewAssetLoader 以
 * https://appassets.androidplatform.net 加载，
 * 保证 JS / localStorage 均可用，本地资源离线可跑。
 *
 * 注意：必须继承原生 android.app.Activity（非 AppCompatActivity），
 * 与主题 android:Theme.Material.* 兼容；AppCompatActivity 会强制要求
 * Theme.AppCompat，否则打开即 IllegalStateException 闪退。
 */
public class MainActivity extends Activity {

    private WebView webView;

    private final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage：题库/进度本地存储
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                // 非本地壳域名（外部链接）交给系统浏览器打开
                if (!"appassets.androidplatform.net".equals(url.getHost())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {
                        // 无可用浏览器时忽略
                    }
                    return true;
                }
                return false;
            }
        });

        // 壳域名映射到 assets/ 根目录，加载应用入口
        webView.loadUrl("https://appassets.androidplatform.net/assets/app.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

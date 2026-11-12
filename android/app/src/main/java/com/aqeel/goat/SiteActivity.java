package com.aqeel.goat;
import android.app.Activity; import android.app.DownloadManager; import android.content.*; import android.net.*; import android.os.*;
import android.provider.MediaStore; import android.util.Base64; import android.view.*; import android.webkit.*; import android.widget.*;
import java.io.OutputStream;
public class SiteActivity extends Activity {
  WebView w; ValueCallback<Uri[]> fileCb; ProgressBar bar; String home;
  @Override protected void onCreate(Bundle s) {
    super.onCreate(s);
    home = getIntent().getStringExtra("url");
    FrameLayout f = new FrameLayout(this); f.setBackgroundColor(0xFF0B0B10);
    w = new WebView(this); f.addView(w, -1, -1);
    bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    f.addView(bar, new FrameLayout.LayoutParams(-1, 6)); setContentView(f);
    WebSettings st = w.getSettings();
    st.setJavaScriptEnabled(true); st.setDomStorageEnabled(true); st.setDatabaseEnabled(true);
    st.setAllowFileAccess(false); st.setMediaPlaybackRequiresUserGesture(false);
    st.setLoadWithOverviewMode(true); st.setCacheMode(WebSettings.LOAD_DEFAULT);
    CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
    w.addJavascriptInterface(new Object() {
      @JavascriptInterface public void save(String name, String mime, String b64) { saveFile(name, mime, b64); }
    }, "AndroidApp");
    w.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl(); String sc = u.getScheme();
        if (sc.equals("http") || sc.equals("https")) { if (u.getHost()!=null && Uri.parse(home).getHost().equals(u.getHost())) return false; if (r.isRedirect()) return false; }
        if (sc.equals("blob") || sc.equals("data")) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) {}
        return true;
      }
    });
    w.setWebChromeClient(new WebChromeClient() {
      @Override public void onProgressChanged(WebView v, int p) { bar.setProgress(p); bar.setVisibility(p>=100?View.GONE:View.VISIBLE); }
      @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
        if (fileCb != null) fileCb.onReceiveValue(null); fileCb = cb;
        try { startActivityForResult(p.createIntent(), 7); } catch (Exception e) { fileCb = null; return false; }
        return true;
      }
    });
    w.setDownloadListener((url, ua, cd, mime, len) -> {
      String name = URLUtil.guessFileName(url, cd, mime);
      if (url.startsWith("blob:")) {
        w.evaluateJavascript("(function(){fetch('"+url+"').then(r=>r.blob()).then(b=>{var f=new FileReader();f.onload=function(){AndroidApp.save('"+name.replace("'","")+"','"+mime+"',f.result.split(',')[1]);};f.readAsDataURL(b);});})()", null);
      } else if (url.startsWith("data:")) {
        int c = url.indexOf(','); saveFile(name, mime, url.substring(c+1));
      } else {
        DownloadManager.Request rq = new DownloadManager.Request(Uri.parse(url));
        rq.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        rq.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
        ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(rq);
        Toast.makeText(this, "Downloading…", Toast.LENGTH_SHORT).show();
      }
    });
    if (s != null) w.restoreState(s); else w.loadUrl(home);
  }
  void saveFile(String name, String mime, String b64) {
    runOnUiThread(() -> { try {
      byte[] d = Base64.decode(b64, Base64.DEFAULT);
      if (Build.VERSION.SDK_INT >= 29) {
        ContentValues v = new ContentValues(); v.put(MediaStore.MediaColumns.DISPLAY_NAME, name); v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        OutputStream o = getContentResolver().openOutputStream(u); o.write(d); o.close();
      } else {
        java.io.File f = new java.io.File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), name);
        java.io.FileOutputStream o = new java.io.FileOutputStream(f); o.write(d); o.close();
      }
      Toast.makeText(this, "Saved to Downloads: " + name, Toast.LENGTH_LONG).show();
    } catch (Exception e) { Toast.makeText(this, "Save failed", Toast.LENGTH_LONG).show(); } });
  }
  @Override protected void onActivityResult(int rq, int rs, Intent d) {
    if (rq == 7 && fileCb != null) { fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(rs, d)); fileCb = null; }
  }
  @Override protected void onSaveInstanceState(Bundle s) { super.onSaveInstanceState(s); w.saveState(s); }
  @Override public void onBackPressed() { if (w.canGoBack()) w.goBack(); else finish(); }
  @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }
  @Override protected void onDestroy() { w.destroy(); super.onDestroy(); }
}

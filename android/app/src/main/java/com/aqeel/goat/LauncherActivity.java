package com.aqeel.goat;
import android.app.Activity; import android.content.Intent; import android.graphics.*; import android.graphics.drawable.GradientDrawable;
import android.os.Bundle; import android.view.*; import android.widget.*;
public class LauncherActivity extends Activity {
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER);
    root.setBackgroundColor(Color.parseColor("#0B0B10")); root.setPadding(dp(24),dp(24),dp(24),dp(24));
    TextView t = new TextView(this); t.setText("CHOOSE YOUR LEAGUE"); t.setTextColor(Color.parseColor("#B9A6FF"));
    t.setTextSize(14); t.setLetterSpacing(0.25f); t.setGravity(Gravity.CENTER); t.setPadding(0,0,0,dp(28));
    root.addView(t);
    root.addView(btn("TELEGOAT", "#7B2CFF", "#3B0A8F", Sites.TELEGOAT));
    root.addView(btn("FINALISSIMA", "#E8B04A", "#7A1020", Sites.FINALISSIMA));
    setContentView(root);
  }
  int dp(int v){ return (int)(v*getResources().getDisplayMetrics().density); }
  View btn(String label, String c1, String c2, final String url) {
    TextView v = new TextView(this); v.setText(label); v.setTextColor(Color.WHITE); v.setTextSize(24);
    v.setTypeface(Typeface.DEFAULT_BOLD); v.setLetterSpacing(0.12f); v.setGravity(Gravity.CENTER);
    GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{Color.parseColor(c1), Color.parseColor(c2)});
    g.setCornerRadius(dp(22)); v.setBackground(g);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(120));
    lp.setMargins(0,0,0,dp(20)); v.setLayoutParams(lp);
    v.setOnClickListener(x -> { Intent i = new Intent(this, SiteActivity.class); i.putExtra("url", url); startActivity(i); });
    return v;
  }
}

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const LP_CSS = `
.lp{--bg:#060a09;--bg2:#0a100e;--surface:#0d1512;--surface2:#111c17;--border:rgba(255,255,255,.07);--border2:rgba(20,185,129,.22);--green:#14b981;--gb:#34e0a1;--gd:#0c7a55;--gg:rgba(20,185,129,.30);--ink:#f2f7f4;--soft:#cdd8d3;--muted:#8b9a93;--muted2:#6c7a74;--r:22px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;overflow-x:hidden;background-image:radial-gradient(900px 600px at 78% -8%,rgba(20,185,129,.16),transparent 60%),radial-gradient(700px 500px at -10% 18%,rgba(20,185,129,.08),transparent 55%)}
.lp *{box-sizing:border-box;margin:0;padding:0}
.lp a{color:inherit;text-decoration:none}
.lp button{font-family:inherit}
.lp img{max-width:100%;height:auto;display:block}
/* HEADER */
.lp-header{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 24px;height:68px;display:flex;align-items:center;transition:all .35s}
.lp-header.scrolled{background:rgba(6,10,9,.9);backdrop-filter:blur(18px);border-bottom:1px solid var(--border)}
.lp-nav-inner{max-width:1180px;margin:0 auto;width:100%;display:flex;align-items:center;gap:40px}
.lp-logo{font-family:'Sora',sans-serif;font-weight:800;font-size:22px;color:var(--gb);letter-spacing:-.5px;margin-right:auto;cursor:pointer}
.lp-logo span{color:var(--ink)}
.lp-nav-links{display:flex;gap:28px;list-style:none}
.lp-nav-links a{font-size:14px;color:var(--soft);font-weight:500;transition:color .2s;cursor:pointer}
.lp-nav-links a:hover{color:var(--green)}
.lp-nav-cta{background:var(--green);color:#000;padding:10px 22px;border-radius:50px;font-weight:700;font-size:14px;transition:all .2s;white-space:nowrap;border:none;cursor:pointer}
.lp-nav-cta:hover{background:var(--gb)}
.lp-ham{display:none;background:none;border:none;cursor:pointer;padding:4px;flex-direction:column;gap:5px}
.lp-ham span{display:block;width:22px;height:2px;background:var(--ink);border-radius:2px}
.lp-mob-menu{display:none;position:fixed;inset:0;z-index:99;background:rgba(6,10,9,.97);backdrop-filter:blur(24px);flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:80px 24px 40px}
.lp-mob-menu.open{display:flex}
.lp-mob-menu a{font-size:22px;font-weight:600;color:var(--soft);cursor:pointer}
.lp-mob-menu a:hover{color:var(--green)}
.lp-mob-close{position:absolute;top:22px;right:24px;background:none;border:none;color:var(--muted);font-size:24px;cursor:pointer}
/* HERO */
.lp-hero{min-height:100vh;display:flex;align-items:center;padding:100px 24px 80px;position:relative;overflow:hidden}
.lp-hero-inner{max-width:1180px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.lp-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(20,185,129,.12);border:1px solid var(--border2);color:var(--green);padding:6px 14px;border-radius:50px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:20px}
.lp-hero-h1{font-family:'Sora',sans-serif;font-size:clamp(36px,5vw,60px);font-weight:800;line-height:1.08;letter-spacing:-.04em;color:var(--ink);margin-bottom:20px}
.lp-hero-h1 em{color:var(--green);font-style:normal}
.lp-hero-sub{font-size:clamp(15px,1.6vw,18px);color:var(--soft);max-width:480px;margin-bottom:36px;line-height:1.7}
.lp-hero-btns{display:flex;gap:14px;flex-wrap:wrap}
.btn-primary{background:var(--green);color:#000;padding:14px 28px;border-radius:50px;font-weight:700;font-size:15px;transition:all .2s;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.btn-primary:hover{background:var(--gb);transform:translateY(-2px);box-shadow:0 8px 30px rgba(20,185,129,.35)}
.btn-ghost{background:transparent;color:var(--soft);padding:14px 24px;border-radius:50px;font-weight:600;font-size:15px;transition:all .2s;border:1px solid var(--border);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.btn-ghost:hover{border-color:var(--green);color:var(--green)}
.lp-hero-glow{position:absolute;top:10%;right:5%;width:700px;height:700px;background:radial-gradient(circle,rgba(20,185,129,.12),transparent 65%);pointer-events:none}
/* PHONE */
.lp-phone-wrap{position:relative;display:flex;justify-content:center}
.lp-phone{width:278px;background:#0d1512;border-radius:44px;padding:14px;box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08);animation:lpFloat 5s ease-in-out infinite;position:relative;z-index:2}
.lp-phone-inner{background:#111c17;border-radius:32px;overflow:hidden;height:520px}
.lp-phone-notch{height:26px;background:#060a09;display:flex;align-items:center;justify-content:center}
.lp-phone-notch-pill{width:70px;height:6px;background:#1a1a1a;border-radius:3px}
.lp-phone-body{padding:14px;height:calc(100% - 26px);overflow:hidden}
.p-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.p-greet{font-size:10px;color:var(--muted)}.p-name{font-size:13px;font-weight:700;color:var(--ink)}
.p-ava{width:32px;height:32px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000}
.p-balance{background:linear-gradient(135deg,#14b981 0%,#0c7a55 100%);border-radius:16px;padding:14px;margin-bottom:12px}
.p-bal-label{font-size:9px;color:rgba(0,0,0,.6);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.p-bal-val{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:#000;margin:3px 0}
.p-bal-row{display:flex;gap:10px;margin-top:6px}
.p-bal-item{flex:1}
.p-bal-item-l{font-size:8px;color:rgba(0,0,0,.5);text-transform:uppercase}
.p-bal-item-v{font-size:11px;font-weight:700;color:#000}
.p-stitle{font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px;margin-top:10px}
.p-tx{display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.p-tx-ic{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.p-tx-info{flex:1;min-width:0}
.p-tx-n{font-size:10px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-tx-c{font-size:8px;color:var(--muted)}
.p-tx-v{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600}
.p-tx-v.neg{color:#f87171}.p-tx-v.pos{color:var(--green)}
.p-bar-row{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.p-bar-label{font-size:8px;color:var(--muted);width:56px;flex-shrink:0}
.p-bar-bg{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px}
.p-bar-fill{height:100%;border-radius:2px;background:var(--green)}
.p-bar-pct{font-size:8px;color:var(--muted2);width:24px;text-align:right;flex-shrink:0}
/* FCARDS */
.fcard{position:absolute;background:rgba(13,21,18,.9);border:1px solid var(--border2);border-radius:16px;padding:10px 14px;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:3;white-space:nowrap}
.fcard-label{font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.fcard-value{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:700;color:var(--gb);line-height:1}
.fcard-sub{font-size:10px;color:var(--muted);margin-top:2px}
.fcard-dot{width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;margin-right:4px;animation:lpPulse 2s infinite}
@keyframes lpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes lpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
/* TICKER */
.lp-ticker{overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:13px 0;background:rgba(10,16,14,.8)}
.lp-ticker-track{display:flex;width:max-content;animation:lpTicker 30s linear infinite}
.lp-ticker-item{display:flex;align-items:center;gap:8px;padding:0 28px;font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap}
.lp-ticker-item b{color:var(--green)}
@keyframes lpTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
/* REVEAL */
.lp-reveal{opacity:0;transform:translateY(24px);transition:opacity .65s,transform .65s}
.lp-reveal.vis{opacity:1;transform:none}
.lp-reveal-d1{transition-delay:.1s}.lp-reveal-d2{transition-delay:.2s}.lp-reveal-d3{transition-delay:.3s}.lp-reveal-d4{transition-delay:.4s}
/* SECTION */
.lp-section{padding:96px 24px;position:relative}
.lp-container{max-width:1180px;margin:0 auto;width:100%}
.lp-section-tag{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--green);margin-bottom:14px}
.lp-section-tag::before{content:'';width:18px;height:2px;background:var(--green);border-radius:1px}
.lp-h2{font-family:'Sora',sans-serif;font-size:clamp(28px,4vw,46px);font-weight:800;line-height:1.1;letter-spacing:-.03em;margin-bottom:14px}
.lp-h2 em{color:var(--green);font-style:normal}
.lp-lead{font-size:clamp(14px,1.4vw,17px);color:var(--soft);max-width:560px;line-height:1.7}
/* FEATURES */
.lp-feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center}
.lp-feat-grid.rev{direction:rtl}
.lp-feat-grid.rev > *{direction:ltr}
.lp-feat-bullets{list-style:none;margin-top:20px;display:flex;flex-direction:column;gap:9px}
.lp-feat-bullets li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--soft)}
.lp-feat-bullets li::before{content:'✓';color:var(--green);font-weight:700;flex-shrink:0;margin-top:1px}
.lp-feat-vis{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;position:relative;overflow:hidden;min-height:240px;display:flex;flex-direction:column;justify-content:center}
.lp-feat-vis::before{content:'';position:absolute;top:-50%;left:-30%;width:80%;height:80%;background:radial-gradient(circle,rgba(20,185,129,.1),transparent 70%);pointer-events:none}
/* WA SECTION */
.lp-wa-section{padding:96px 24px;background:radial-gradient(ellipse 120% 60% at 50% 0%,rgba(20,185,129,.07),transparent 60%);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.lp-wa-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.lp-wa-features{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
.lp-wa-feat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;transition:border-color .2s}
.lp-wa-feat:hover{border-color:var(--border2)}
.lp-wa-feat-icon{font-size:20px;margin-bottom:6px}
.lp-wa-feat-title{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px}
.lp-wa-feat-desc{font-size:11px;color:var(--muted);line-height:1.5}
.lp-wa-phone-wrap{display:flex;justify-content:center}
.lp-wa-phone{width:278px;background:#0a0f0d;border-radius:44px;padding:14px;box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08)}
.lp-wa-phone-inner{background:#111c17;border-radius:32px;overflow:hidden;height:520px;display:flex;flex-direction:column}
.lp-wa-topbar{background:#1a2e26;padding:11px 14px;display:flex;align-items:center;gap:9px;border-bottom:1px solid rgba(255,255,255,.05)}
.lp-wa-ava{width:32px;height:32px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.lp-wa-bname{font-size:12px;font-weight:700;color:var(--ink)}.lp-wa-bstatus{font-size:9px;color:var(--green)}
.lp-wa-msgs{flex:1;overflow:hidden;padding:10px;display:flex;flex-direction:column;gap:7px;background:#0d1512}
.wm{max-width:87%;padding:7px 10px;border-radius:10px;font-size:10px;line-height:1.55}
.wm.user{background:#1a4a35;margin-left:auto;border-radius:10px 10px 2px 10px;color:var(--soft)}
.wm.bot{background:#192820;border-radius:10px 10px 10px 2px;color:var(--soft)}
.wm .wt{font-size:8px;color:var(--muted2);text-align:right;margin-top:3px}
.lp-wa-input-bar{background:#0a100e;padding:8px 12px;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(255,255,255,.05)}
.lp-wa-text-input{flex:1;background:#192820;border-radius:18px;padding:6px 11px;font-size:10px;color:var(--muted)}
.lp-wa-send-btn{width:26px;height:26px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
/* ACTIONS GRID */
.lp-actions-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.lp-action-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px;transition:all .22s;cursor:default}
.lp-action-card:hover{border-color:var(--border2);background:var(--surface2);transform:translateY(-3px)}
.lp-ac-icon{font-size:26px;margin-bottom:9px}.lp-ac-title{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px}.lp-ac-desc{font-size:11px;color:var(--muted);line-height:1.5}
/* STATS + TESTIMONIALS */
.lp-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;text-align:center;margin-bottom:56px}
.lp-stat-num{font-family:'Sora',sans-serif;font-size:clamp(32px,3.5vw,50px);font-weight:800;color:var(--gb);letter-spacing:-.03em;line-height:1}
.lp-stat-label{font-size:12px;color:var(--muted);margin-top:6px}
.lp-test-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.lp-test-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:26px;transition:border-color .2s}
.lp-test-card:hover{border-color:var(--border2)}
.lp-test-stars{color:var(--green);font-size:13px;margin-bottom:11px}
.lp-test-text{font-size:13px;color:var(--soft);line-height:1.75;margin-bottom:18px;font-style:italic}
.lp-test-author{display:flex;align-items:center;gap:10px}
.lp-test-ava{width:36px;height:36px;border-radius:50%;background:var(--gd);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--gb)}
.lp-test-name{font-size:12px;font-weight:700;color:var(--ink)}.lp-test-role{font-size:10px;color:var(--muted)}
/* PLANS */
.lp-plans-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;max-width:800px;margin:0 auto 20px}
.lp-plan{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:34px;position:relative;overflow:hidden}
.lp-plan.featured{border-color:var(--green);background:linear-gradient(135deg,rgba(20,185,129,.07),var(--surface))}
.lp-plan.featured::before{content:'MAIS POPULAR';position:absolute;top:18px;right:-28px;background:var(--green);color:#000;font-size:9px;font-weight:800;padding:4px 38px;transform:rotate(45deg);letter-spacing:.08em}
.lp-plan-name{font-family:'Sora',sans-serif;font-size:17px;font-weight:700;margin-bottom:6px;color:var(--ink)}
.lp-plan-price-row{display:flex;align-items:baseline;gap:4px;margin-bottom:6px}
.lp-plan-price{font-family:'Sora',sans-serif;font-size:38px;font-weight:800;color:var(--gb);letter-spacing:-.03em;line-height:1}
.lp-plan-price-suffix{font-size:15px;font-weight:500;color:var(--muted)}
.lp-plan-desc{font-size:13px;color:var(--muted);margin-bottom:18px}
.lp-plan-features{list-style:none;margin-bottom:24px;display:flex;flex-direction:column;gap:9px}
.lp-plan-features li{display:flex;gap:8px;font-size:13px;color:var(--soft)}
.lp-plan-features li::before{content:'✓';color:var(--green);font-weight:700;flex-shrink:0}
.lp-guarantee{text-align:center;font-size:12px;color:var(--muted);margin-top:16px}
/* FAQ */
.lp-faq-list{display:flex;flex-direction:column;gap:10px;max-width:700px;margin:0 auto}
.lp-faq-item{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color .2s}
.lp-faq-item.open{border-color:var(--border2)}
.lp-faq-q{width:100%;text-align:left;padding:17px 20px;background:none;border:none;cursor:pointer;color:var(--ink);display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:600;gap:12px;line-height:1.4}
.lp-faq-q:hover{color:var(--green)}
.lp-faq-chev{flex-shrink:0;transition:transform .3s;color:var(--muted);font-size:18px}
.lp-faq-item.open .lp-faq-chev{transform:rotate(180deg);color:var(--green)}
.lp-faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease,padding .3s;font-size:13px;color:var(--soft);line-height:1.75;padding:0 20px}
.lp-faq-item.open .lp-faq-a{max-height:400px;padding:0 20px 16px}
/* CTA */
.lp-cta-section{padding:96px 24px}
.lp-cta-box{max-width:760px;margin:0 auto;text-align:center;background:var(--surface);border:1px solid var(--border2);border-radius:28px;padding:60px 40px;position:relative;overflow:hidden}
.lp-cta-box::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:400px;background:radial-gradient(ellipse,rgba(20,185,129,.13),transparent 70%);pointer-events:none}
.lp-cta-box h2{font-family:'Sora',sans-serif;font-size:clamp(28px,4vw,42px);font-weight:800;letter-spacing:-.03em;margin-bottom:12px;position:relative}
.lp-cta-box p{font-size:15px;color:var(--soft);margin-bottom:28px;position:relative}
.lp-cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative}
/* FOOTER */
.lp-footer{border-top:1px solid var(--border);padding:56px 24px 36px;background:rgba(6,10,9,.9)}
.lp-footer-grid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:44px;margin-bottom:44px}
.lp-footer-brand-desc{font-size:12px;color:var(--muted);line-height:1.7;margin-top:11px;max-width:260px}
.lp-footer-col h4{font-size:12px;font-weight:700;color:var(--ink);margin-bottom:14px;text-transform:uppercase;letter-spacing:.07em}
.lp-footer-col ul{list-style:none;display:flex;flex-direction:column;gap:8px}
.lp-footer-col ul li a,.lp-footer-col ul li span{font-size:12px;color:var(--muted);cursor:pointer;transition:color .2s}
.lp-footer-col ul li a:hover,.lp-footer-col ul li span:hover{color:var(--green)}
.lp-footer-bottom{max-width:1180px;margin:0 auto;border-top:1px solid var(--border);padding-top:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.lp-footer-bottom p{font-size:11px;color:var(--muted2)}
.lp-footer-social{display:flex;gap:10px}
.lp-footer-social a{width:32px;height:32px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--muted);transition:all .2s}
.lp-footer-social a:hover{border-color:var(--green);color:var(--green)}
/* WA FAB */
.lp-wa-fab{position:fixed;bottom:26px;right:26px;z-index:200;width:54px;height:54px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 20px rgba(37,211,102,.4);transition:transform .2s}
.lp-wa-fab:hover{transform:scale(1.12)}

/* ─── INSTITUTO ───────────────────────────────── */
.lp-instituto-hero{position:relative;height:480px;overflow:hidden;display:flex;align-items:center;justify-content:center}
@media(max-width:600px){.lp-instituto-hero{height:320px}}
.lp-instituto-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat}
.lp-instituto-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(6,10,9,.55) 0%,rgba(6,10,9,.85) 100%)}
.lp-instituto-hero-content{position:relative;z-index:2;text-align:center;padding:24px}
.lp-instituto-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(20,185,129,.18);border:1px solid var(--border2);border-radius:50px;padding:6px 16px;margin-bottom:18px;font-size:11px;font-weight:700;color:var(--gb);letter-spacing:.06em;text-transform:uppercase}
.lp-instituto-hero-name{font-family:'Sora',sans-serif;font-size:clamp(28px,5vw,56px);font-weight:800;color:var(--ink);letter-spacing:-.03em;text-shadow:0 2px 20px rgba(0,0,0,.5);margin-bottom:10px}
.lp-instituto-hero-tagline{font-size:clamp(14px,1.8vw,18px);color:var(--soft);max-width:540px;margin:0 auto}
.lp-instituto-logo-wrap{width:80px;height:80px;border-radius:20px;overflow:hidden;border:2px solid rgba(20,185,129,.4);background:#0d1512;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px}
.lp-instituto-logo-wrap img{width:100%;height:100%;object-fit:contain}

.lp-causa-section{padding:96px 24px;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.lp-causa-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.lp-causa-photo{border-radius:var(--r);overflow:hidden;aspect-ratio:4/3;background:var(--surface)}
.lp-causa-photo img{width:100%;height:100%;object-fit:cover}
.lp-causa-photo-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;color:var(--muted)}
.lp-causa-stats{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:28px}
.lp-causa-stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.lp-causa-stat-num{font-family:'Sora',sans-serif;font-size:26px;font-weight:800;color:var(--gb)}
.lp-causa-stat-label{font-size:11px;color:var(--muted);margin-top:3px}

.lp-galeria-section{padding:80px 24px}
.lp-galeria-header{max-width:1180px;margin:0 auto 40px;text-align:center}
.lp-galeria-grid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.lp-gal-item{border-radius:18px;overflow:hidden;aspect-ratio:4/5;background:var(--surface);position:relative;cursor:zoom-in}
.lp-gal-item img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.lp-gal-item:hover img{transform:scale(1.04)}
.lp-gal-item-placeholder{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--surface2);font-size:32px;color:var(--muted)}
.lp-gal-item-placeholder span{font-size:11px;color:var(--muted2)}
.lp-gal-caption{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(6,10,9,.85));padding:20px 14px 12px;font-size:11px;color:var(--soft);opacity:0;transition:opacity .3s}
.lp-gal-item:hover .lp-gal-caption{opacity:1}

.lp-impacto-section{padding:80px 24px;background:linear-gradient(180deg,transparent,rgba(12,122,85,.05) 40%,transparent)}
.lp-impacto-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.lp-impacto-quote{font-family:'Sora',sans-serif;font-size:clamp(20px,2.5vw,28px);font-weight:700;line-height:1.4;color:var(--ink);margin-bottom:20px}
.lp-impacto-quote em{color:var(--green);font-style:normal}
.lp-impacto-tower{display:flex;align-items:flex-end;justify-content:center;gap:8px;height:160px}
.lp-impacto-bar{width:24px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--gb),var(--green));transform:scaleY(0);transform-origin:bottom;transition:transform 1.2s ease}
.lp-impacto-bar.anim{transform:scaleY(1)}

.lp-conecta-section{padding:80px 24px;border-top:1px solid var(--border)}
.lp-conecta-inner{max-width:900px;margin:0 auto;text-align:center}
.lp-conecta-flow{display:flex;align-items:center;justify-content:center;gap:0;margin:40px 0;flex-wrap:wrap}
.lp-conecta-node{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px 24px;text-align:center;min-width:140px}
.lp-conecta-node-icon{font-size:28px;margin-bottom:8px}
.lp-conecta-node-label{font-size:12px;font-weight:700;color:var(--ink)}
.lp-conecta-node-sub{font-size:10px;color:var(--muted);margin-top:2px}
.lp-conecta-arrow{font-size:20px;color:var(--green);padding:0 12px;flex-shrink:0}
.lp-conecta-1pct{display:inline-flex;align-items:center;gap:8px;background:rgba(20,185,129,.1);border:1px solid var(--border2);border-radius:50px;padding:10px 20px;margin-bottom:24px}
.lp-conecta-1pct-num{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--green)}
.lp-conecta-1pct-text{font-size:13px;color:var(--soft);text-align:left;line-height:1.4}

/* ABOUT */
.lp-about-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.lp-about-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.lp-about-stat{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.lp-about-stat:last-child{border-bottom:none}
.lp-about-stat-label{font-size:12px;color:var(--muted)}
.lp-about-stat-val{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--green)}

/* RESPONSIVE */
@media(max-width:900px){
  .lp-hero-inner,.lp-wa-inner,.lp-feat-grid,.lp-causa-inner,.lp-impacto-inner,.lp-about-inner{grid-template-columns:1fr;gap:40px}
  .lp-feat-grid.rev{direction:ltr}
  .lp-phone-wrap{order:-1}
  .lp-stats-grid{grid-template-columns:repeat(2,1fr);gap:20px}
  .lp-test-grid,.lp-plans-grid{grid-template-columns:1fr}
  .lp-actions-grid{grid-template-columns:repeat(2,1fr)}
  .lp-footer-grid{grid-template-columns:1fr 1fr;gap:28px}
  .lp-nav-links,.lp-nav-cta{display:none}
  .lp-ham{display:flex}
  .lp-galeria-grid{grid-template-columns:repeat(2,1fr)}
  .lp-conecta-flow{gap:8px}
  .lp-conecta-arrow{display:none}
}
@media(max-width:500px){
  .lp-hero{padding:80px 16px 56px}
  .lp-section,.lp-wa-section,.lp-causa-section,.lp-galeria-section,.lp-impacto-section,.lp-conecta-section,.lp-cta-section{padding:60px 16px}
  .lp-footer-grid{grid-template-columns:1fr}
  .lp-actions-grid{grid-template-columns:1fr 1fr}
  .lp-stats-grid{grid-template-columns:1fr 1fr}
  .lp-galeria-grid{grid-template-columns:repeat(2,1fr);gap:12px}
  .lp-wa-features{grid-template-columns:1fr}
  .lp-causa-stats{grid-template-columns:1fr 1fr}
  .lp-cta-box{padding:40px 20px}
}
`;

// ─── DEFAULT CMS CONTENT ──────────────────────────────────────────────────────
export const DEFAULT_CMS_CONTENT = {
  navbar: { brand: 'Freedom', ctaText: 'Entrar na minha conta' },
  tracking: {
    gtm: '',
    ga4: '',
    metaPixel: '',
  },
  hero: {
    label: 'Gestão Financeira com IA',
    headline: 'Liberdade financeira começa aqui',
    sub: 'O sistema completo para famílias controlarem finanças, orçamentos, dívidas e investimentos — tudo pelo WhatsApp.',
    cta1: 'Ver os planos',
    cta2: 'Ver como funciona',
  },
  whatsapp: {
    tag: 'WhatsApp Bot',
    headline: 'Lance tudo pelo WhatsApp',
    sub: 'Sem apps extras. Registre gastos, peça relatórios e controle seu orçamento diretamente no chat. A IA entende linguagem natural.',
    features: [
      { icon: '💬', title: 'Lançamento rápido', desc: 'Diga "gastei 50 no mercado no pix" e está lançado' },
      { icon: '📊', title: 'Relatórios', desc: 'Peça o resumo do mês em segundos' },
      { icon: '🖼️', title: 'Leitura de comprovante', desc: 'Envie a foto e o bot extrai tudo automaticamente' },
      { icon: '💳', title: 'Cartão de crédito', desc: 'Registre compras parceladas com facilidade' },
      { icon: '🏦', title: 'Renda e receitas', desc: 'Registre entradas de salário, freelances e mais' },
      { icon: '✏️', title: 'Edição', desc: 'Corrija lançamentos errados sem sair do WhatsApp' },
    ],
  },
  features: [
    { tag: 'Dashboard', headline: 'Visão completa das suas finanças', sub: 'Acompanhe entradas, saídas e saldo em tempo real. Relatórios automáticos que mostram pra onde está indo seu dinheiro.', bullets: ['Dashboard com gráficos interativos', 'Relatórios mensais e anuais automáticos', 'Categorização inteligente por IA', 'Histórico completo de transações'], rev: false },
    { tag: 'Orçamento', headline: 'Controle cada centavo do mês', sub: 'Defina limites por categoria e receba alertas antes de estourar o orçamento. Nunca mais se surpreender com o extrato.', bullets: ['Limite mensal por categoria de gasto', 'Alertas automáticos via WhatsApp', 'Comparativo mês a mês', 'Sugestões inteligentes de corte'], rev: true },
    { tag: 'Caixinhas', headline: 'Realize seus sonhos com disciplina', sub: 'Crie cofrinhos virtuais para cada objetivo. Viagem, emergência, educação — tudo organizado.', bullets: ['Criação de metas personalizadas', 'Acompanhamento visual de progresso', 'Aportes automáticos ou manuais', 'Simulação de prazo para atingir a meta'], rev: false },
    { tag: 'Família', headline: 'Gestão financeira para toda a família', sub: 'Convide membros e gerencie as finanças juntos. Cada um lança pelo próprio WhatsApp.', bullets: ['Múltiplos membros por conta familiar', 'Permissões e controle por membro', 'Resumo consolidado da família', 'Histórico de quem lançou o quê'], rev: true },
  ],
  actions: [
    { icon: '💸', title: 'Registrar gasto', desc: 'Lance despesas em segundos pelo WhatsApp' },
    { icon: '💰', title: 'Registrar receita', desc: 'Salário, freelance, aluguel e mais' },
    { icon: '💳', title: 'Cartão de crédito', desc: 'Parcelas e faturas sob controle' },
    { icon: '📊', title: 'Ver relatório', desc: 'Resumo financeiro instantâneo' },
    { icon: '🎯', title: 'Metas / Caixinhas', desc: 'Objetivos e poupanças organizados' },
    { icon: '⚠️', title: 'Controle de dívidas', desc: 'Parcelas e dívidas num só lugar' },
    { icon: '👨‍👩‍👧', title: 'Gestão familiar', desc: 'Toda a família conectada' },
    { icon: '📈', title: 'Investimentos', desc: 'Acompanhe ações e carteira' },
  ],
  instituto: {
    nome: 'Instituto Wise Madness',
    tagline: 'Transformando jovens carentes através da educação financeira',
    descricao: 'O Instituto Wise Madness acredita que educação financeira é o primeiro passo para romper o ciclo de pobreza. Trabalhamos com jovens e adolescentes em situação de vulnerabilidade social, oferecendo formação completa para que possam construir um futuro financeiro sólido e digno.',
    missao: 'Nossa missão é simples: levar conhecimento financeiro a quem mais precisa. Cada jovem formado representa uma família inteira com chance real de mudar de vida.',
    logo: '',
    heroImage: '',
    fotoInstituicao: '/instituto.jpg',
    galeria: [
      { url: '/gal-1.jpg', caption: 'O Poder da Arte na Transformação' },
      { url: '/gal-2.jpg', caption: 'Quero Ajudar! Como?' },
      { url: '/gal-3.jpg', caption: 'Prêmio Responsabilidade Social' },
      { url: '/gal-4.jpg', caption: 'Oportunidades para Todos' },
    ],
    stats: [
      { val: '480+', label: 'Jovens formados' },
      { val: '12', label: 'Escolas parceiras' },
      { val: '8', label: 'Municípios atendidos' },
      { val: '94%', label: 'Aplicam o aprendizado' },
    ],
    impactoQuote: 'Cada assinatura Freedom doa 5% do lucro para que jovens em situação de vulnerabilidade aprendam a construir um futuro financeiro sólido e digno.',
    impactoSub: 'Desde 2022, nossa parceria com o Instituto Wise Madness já transformou a vida de centenas de famílias brasileiras.',
  },
  results: {
    tag: 'Resultados',
    headline: 'Números que transformam vidas',
    stats: [
      { num: '2.400+', label: 'Famílias ativas' },
      { num: 'R$ 12M+', label: 'Controlados por mês' },
      { num: '4.9★', label: 'Avaliação média' },
      { num: '97%', label: 'Renovam a assinatura' },
    ],
  },
  testimonials: [
    { text: 'O Freedom mudou completamente nossa relação com dinheiro. Agora toda a família sabe pra onde vai cada real.', name: 'Ana Paula M.', role: 'Mãe e empreendedora, SP', initial: 'A' },
    { text: 'Consigo lançar tudo pelo WhatsApp sem precisar abrir nenhum app. Em 3 meses quitei minha dívida do cartão.', name: 'Carlos Eduardo S.', role: 'Servidor público, MG', initial: 'C' },
    { text: 'Os relatórios automáticos me ajudaram a entender onde estava perdendo dinheiro. Economizei R$800 em 2 meses.', name: 'Fernanda L.', role: 'Professora, RJ', initial: 'F' },
  ],
  plans: {
    tag: 'Planos',
    headline: 'Simples, transparente, sem surpresas',
    guarantee: '🔒 Garantia de 7 dias · Cancele quando quiser · Suporte em português',
  },
  about: {
    tag: 'Sobre a Mercatta',
    headline: 'Tecnologia que gera liberdade financeira',
    sub: 'A Mercatta é uma empresa brasileira de tecnologia financeira com o propósito de democratizar a gestão financeira familiar no Brasil.',
    stats: [
      { label: 'Fundação', val: '2021' },
      { label: 'Famílias atendidas', val: '2.400+' },
      { label: 'NPS', val: '87' },
      { label: 'Cidades no Brasil', val: '340+' },
    ],
  },
  faq: [
    { q: 'O Freedom é gratuito?', a: 'Sim! Temos um plano gratuito com funcionalidades essenciais. Para recursos avançados, o plano Premium custa R$19,90/mês.' },
    { q: 'Preciso instalar algum aplicativo?', a: 'Não! O Freedom funciona diretamente pelo WhatsApp. Basta enviar uma mensagem pro nosso bot.' },
    { q: 'Meus dados financeiros estão seguros?', a: 'Absolutamente. Usamos criptografia e seguimos todas as diretrizes da LGPD.' },
    { q: 'Posso usar com minha família inteira?', a: 'Sim! No plano Premium você convida até 5 membros da família.' },
    { q: 'Como funciona o suporte?', a: 'Suporte em português via WhatsApp e e-mail. Tempo médio de resposta: 2 horas em dias úteis.' },
    { q: 'Posso cancelar quando quiser?', a: 'Sim, sem multa ou fidelidade. Garantia de reembolso de 7 dias sem perguntas.' },
  ],
  cta: {
    headline: 'Comece a organizar hoje.',
    sub: 'Junte-se às 2.400+ famílias que já controlam suas finanças com liberdade.',
    btn: 'Assinar o Freedom',
  },
  footer: {
    brand: 'Freedom',
    desc: 'O sistema de gestão financeira familiar com IA pelo WhatsApp. Controle, orçamento, metas e muito mais.',
    disclaimer: '© 2025 Mercatta Tech. Todos os direitos reservados.',
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
    whatsapp: '',
  },
};

// ─── PHONE DASHBOARD ──────────────────────────────────────────────────────────
function PhoneDashboard() {
  const txns = [
    { ic: '🛒', name: 'Supermercado', cat: 'Alimentação', val: '-R$ 287', neg: true },
    { ic: '⛽', name: 'Combustível', cat: 'Transporte', val: '-R$ 120', neg: true },
    { ic: '💰', name: 'Salário', cat: 'Renda', val: '+R$ 6.500', neg: false },
    { ic: '💊', name: 'Farmácia', cat: 'Saúde', val: '-R$ 45', neg: true },
  ];
  return (
    <div className="lp-phone-body">
      <div className="p-header">
        <div><div className="p-greet">Bom dia,</div><div className="p-name">João Silva 👋</div></div>
        <div className="p-ava">JS</div>
      </div>
      <div className="p-balance">
        <div className="p-bal-label">Saldo do Mês</div>
        <div className="p-bal-val">R$ 8.450,00</div>
        <div className="p-bal-row">
          <div className="p-bal-item"><div className="p-bal-item-l">↑ Receitas</div><div className="p-bal-item-v">R$ 12.300</div></div>
          <div className="p-bal-item"><div className="p-bal-item-l">↓ Gastos</div><div className="p-bal-item-v">R$ 3.850</div></div>
        </div>
      </div>
      <div className="p-stitle">Últimos Lançamentos</div>
      {txns.map((t, i) => (
        <div className="p-tx" key={i}>
          <div className="p-tx-ic" style={{ background: t.neg ? 'rgba(248,113,113,.13)' : 'rgba(20,185,129,.13)' }}>{t.ic}</div>
          <div className="p-tx-info"><div className="p-tx-n">{t.name}</div><div className="p-tx-c">{t.cat}</div></div>
          <div className={`p-tx-v ${t.neg ? 'neg' : 'pos'}`}>{t.val}</div>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <div className="p-stitle">Orçamento</div>
        {[['Alimentação', 72], ['Transporte', 45], ['Lazer', 30]].map(([l, p]) => (
          <div className="p-bar-row" key={l}>
            <div className="p-bar-label">{l}</div>
            <div className="p-bar-bg"><div className="p-bar-fill" style={{ width: p + '%' }} /></div>
            <div className="p-bar-pct">{p}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaPhone() {
  const msgs = [
    { from: 'user', text: 'gastei 180 no mercado no pix' },
    { from: 'bot', text: '📝 Confirmar lançamento?\n• Supermercado – R$ 180,00\n• PIX  •  Alimentação\n📅 Hoje\n\nResponda *sim* para confirmar.' },
    { from: 'user', text: 'sim' },
    { from: 'bot', text: '✅ Lançado!\nSaldo do mês: R$ 8.270,00' },
    { from: 'user', text: 'relatório desse mês' },
    { from: 'bot', text: '📊 *Junho/2025*\n\n💰 Receitas: R$ 12.300\n💸 Gastos: R$ 4.030\n💚 Saldo: R$ 8.270\n\n🔝 Maior: Alimentação' },
  ];
  return (
    <div className="lp-wa-phone">
      <div className="lp-wa-phone-inner">
        <div className="lp-wa-topbar">
          <div className="lp-wa-ava">🤖</div>
          <div><div className="lp-wa-bname">Freedom Bot</div><div className="lp-wa-bstatus">● Online</div></div>
        </div>
        <div className="lp-wa-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`wm ${m.from}`} style={{ whiteSpace: 'pre-line' }}>
              {m.text}
              <div className="wt">{`09:3${i} ${m.from === 'bot' ? '✓✓' : ''}`}</div>
            </div>
          ))}
        </div>
        <div className="lp-wa-input-bar">
          <div className="lp-wa-text-input">Escreva sua mensagem…</div>
          <div className="lp-wa-send-btn">➤</div>
        </div>
      </div>
    </div>
  );
}

function FeatVis({ type }) {
  if (type === 'dashboard') return (
    <div className="lp-feat-vis">
      <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Resumo · Junho</div>
      {[['Receitas', 'R$ 12.300', '#34e0a1'], ['Gastos', 'R$ 4.030', '#f87171'], ['Saldo', 'R$ 8.270', '#14b981']].map(([l, v, c]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--soft)' }}>{l}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: 14 }}>
        {[['🛒 Alimentação', 68], ['🚗 Transporte', 42], ['🏠 Moradia', 90], ['🎭 Lazer', 25]].map(([l, p]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: 'var(--soft)', width: 110 }}>{l}</span>
            <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3 }}>
              <div style={{ width: p + '%', height: '100%', background: p > 80 ? '#f87171' : 'var(--green)', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--muted)', width: 28, textAlign: 'right' }}>{p}%</span>
          </div>
        ))}
      </div>
    </div>
  );
  if (type === 'orcamento') return (
    <div className="lp-feat-vis">
      <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Limites de Orçamento</div>
      {[['🛒 Alimentação', 1200, 820], ['🎭 Lazer', 400, 380], ['🚗 Transporte', 600, 250], ['💊 Saúde', 300, 120]].map(([l, max, used]) => {
        const pct = Math.round(used / max * 100);
        const over = pct >= 90;
        return (
          <div key={l} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: 'var(--soft)' }}>{l}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: over ? '#f87171' : 'var(--green)' }}>R${used} / R${max}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 3 }}>
              <div style={{ width: Math.min(pct, 100) + '%', height: '100%', background: over ? '#f87171' : 'var(--green)', borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
  if (type === 'caixinhas') return (
    <div className="lp-feat-vis">
      <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Minhas Caixinhas</div>
      {[['✈️ Viagem Europa', 15000, 8400], ['🏠 Entrada Apê', 50000, 22000], ['📚 Curso', 3000, 2700], ['🚨 Reserva Emerg.', 10000, 5500]].map(([l, goal, curr]) => {
        const pct = Math.round(curr / goal * 100);
        return (
          <div key={l} style={{ marginBottom: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
              <span style={{ color: 'var(--soft)', fontSize: 12 }}>{l}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--gb)', fontSize: 11 }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 4 }}>
              <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,var(--green),var(--gb))', borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>R$ {curr.toLocaleString('pt-BR')} de R$ {goal.toLocaleString('pt-BR')}</div>
          </div>
        );
      })}
    </div>
  );
  if (type === 'familia') return (
    <div className="lp-feat-vis">
      <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Família Silva</div>
      {[['JS', 'João (Admin)', 'R$ 6.500'], ['AS', 'Ana Silva', 'R$ 3.200'], ['LS', 'Letícia', 'R$ 0'], ['MS', 'Marco', 'R$ 0']].map(([init, name, inc], i) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: i < 2 ? 'var(--green)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: i < 2 ? '#000' : 'var(--muted)', flexShrink: 0 }}>{init}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{name}</div></div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--soft)' }}>{inc}</div>
        </div>
      ))}
      <div style={{ marginTop: 10, padding: '10px', background: 'rgba(20,185,129,.08)', borderRadius: 10, fontSize: 11, color: 'var(--soft)' }}>
        💰 Renda familiar: <strong style={{ color: 'var(--gb)' }}>R$ 9.700,00</strong>
      </div>
    </div>
  );
  return null;
}

const TICKER_ITEMS = [
  { label: 'Famílias atendidas', value: '2.400+' },
  { label: 'Lançamentos/mês', value: '180K+' },
  { label: 'Avaliação App', value: '4.9 ★' },
  { label: 'Economizado', value: 'R$12M+' },
  { label: 'Renovação', value: '97%' },
  { label: 'Suporte PT-BR', value: '24/7' },
];

const TOWER_HEIGHTS = [38, 52, 68, 82, 96, 100, 90, 78];

const FORM_EMBED_URL = 'https://gmlink.mercatta.com.br/f/19c385ae-2b1a-4bc1-aac9-9e8f1a3dda21';

// ─── SIGNUP MODAL ─────────────────────────────────────────────────────────────
function SignupModal({ open, onClose }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#0d1512', border: '1px solid rgba(20,185,129,.25)',
        borderRadius: 24, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, color: '#f2f7f4' }}>
              Crie sua conta grátis
            </div>
            <div style={{ fontSize: 12, color: '#8b9a93', marginTop: 3 }}>7 dias grátis · sem cartão necessário</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8b9a93', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }}
          >✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <iframe
            src={FORM_EMBED_URL}
            width="100%"
            height="600px"
            frameBorder="0"
            title="Cadastro Freedom"
            style={{ display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(null);
  const [towerAnim, setTowerAnim] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const openModal = () => setModalOpen(true);
  const revealRefs = useRef([]);
  const towerRef = useRef(null);

  const { data: cmsRows } = useQuery({
    queryKey: ['LandingCMS'],
    queryFn: () => apiClient.entities.LandingCMS.list(),
  });
  const { data: planRows } = useQuery({
    queryKey: ['Plan'],
    queryFn: () => apiClient.entities.Plan.list(),
  });

  const handleSelectPlan = async (plan) => {
    if (plan.price === 0) {
      window.location.href = '/Login?mode=register';
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const res = await fetch('/api/stripe/public-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, interval: 'month' })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.message || 'Erro ao iniciar pagamento.');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    } finally {
      setLoadingPlan(null);
    }
  };

  const stored = cmsRows?.[0]?.content;
  const cms = stored ? mergeDeep(DEFAULT_CMS_CONTENT, stored) : DEFAULT_CMS_CONTENT;

  const plans = planRows?.length ? planRows.filter(p => p.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(p => ({
    id: p.id,
    name: p.nome || p.name,
    price: p.preco ?? p.price,
    description: p.descricao || p.description,
    features: typeof p.features === 'string' ? p.features.split(',').map(f => f.trim()).filter(Boolean) : p.features || [],
    featured: p.destaque || p.featured,
    stripe_price_id: p.stripe_price_id
  })) : [
    { id: 'free', name: 'Gratuito', price: 0, description: 'Para começar', features: ['Dashboard financeiro', '1 cartão de crédito', '3 caixinhas', 'Bot WhatsApp básico', 'Relatório mensal', '1 membro familiar'], stripe_price_id: null },
    { id: 'premium', name: 'Premium', price: 19.90, description: 'Para famílias que querem mais', features: ['Tudo do plano Gratuito', 'Cartões ilimitados', 'Caixinhas ilimitadas', 'Até 5 membros familiares', 'Relatórios avançados', 'Leitura de comprovantes por foto', 'Suporte prioritário', '5% doado ao Instituto Wise Madness'], stripe_price_id: 'price_premium' },
  ];

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('vis'); }),
      { threshold: 0.12 }
    );
    revealRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [cms]);

  // Inject tracking scripts from CMS
  useEffect(() => {
    if (!cms.tracking) return;
    const { gtm, ga4, metaPixel } = cms.tracking;
    if (gtm) {
      const s = document.createElement('script');
      s.id = 'gtm-script';
      s.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`;
      if (!document.getElementById('gtm-script')) document.head.appendChild(s);
    }
    if (ga4) {
      const s1 = document.createElement('script');
      s1.id = 'ga4-script';
      s1.async = true;
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${ga4}`;
      const s2 = document.createElement('script');
      s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`;
      if (!document.getElementById('ga4-script')) { document.head.appendChild(s1); document.head.appendChild(s2); }
    }
    if (metaPixel) {
      const s = document.createElement('script');
      s.id = 'meta-pixel';
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`;
      if (!document.getElementById('meta-pixel')) document.head.appendChild(s);
    }
  }, [cms.tracking?.gtm, cms.tracking?.ga4, cms.tracking?.metaPixel]);

  useEffect(() => {
    if (!towerRef.current) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setTowerAnim(true); },
      { threshold: 0.4 }
    );
    obs.observe(towerRef.current);
    return () => obs.disconnect();
  }, []);

  const rv = (delay = 0) => {
    const r = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };
    return { ref: r, className: `lp-reveal${delay ? ' lp-reveal-d' + delay : ''}` };
  };

  const handleCheckout = async (plan) => {
    if (!plan.stripe_price_id) { window.location.href = '/register'; return; }
    try {
      const { data } = await apiClient.functions.invoke('createCheckout', { priceId: plan.stripe_price_id });
      if (data?.url) window.location.href = data.url;
    } catch { toast.error('Erro ao iniciar checkout. Tente novamente.'); }
  };

  const go = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); };

  const inst = cms.instituto || DEFAULT_CMS_CONTENT.instituto;

  return (
    <div className="lp">
      <style>{LP_CSS}</style>

      {/* HEADER */}
      <header className={`lp-header${scrolled ? ' scrolled' : ''}`}>
        <nav className="lp-nav-inner">
          <img src="/logo-free.png" alt="Freedom" style={{ height: '28px', cursor: 'pointer', marginRight: 'auto' }} onClick={() => go('hero')} />
          <ul className="lp-nav-links">
            {[['Funcionalidades', 'features'], ['WhatsApp', 'whatsapp'], ['Instituto', 'instituto'], ['Preços', 'planos']].map(([l, id]) => (
              <li key={id}><a onClick={() => go(id)}>{l}</a></li>
            ))}
            <li><a href="/Login" style={{ color: 'var(--ink)', fontWeight: 700 }}>Entrar</a></li>
          </ul>
          <button className="lp-nav-cta" onClick={() => go('planos')}>{cms.navbar.ctaText}</button>
          <button className="lp-ham" onClick={() => setMobileOpen(true)} aria-label="Menu"><span /><span /><span /></button>
        </nav>
      </header>

      {/* MOBILE MENU */}
      <div className={`lp-mob-menu${mobileOpen ? ' open' : ''}`}>
        <button className="lp-mob-close" onClick={() => setMobileOpen(false)}>✕</button>
        {[['Funcionalidades', 'features'], ['WhatsApp', 'whatsapp'], ['Instituto', 'instituto'], ['Preços', 'planos'], ['FAQ', 'faq']].map(([l, id]) => (
          <a key={id} onClick={() => go(id)}>{l}</a>
        ))}
        <a href="/Login" style={{ color: 'var(--ink)', fontWeight: 700 }}>Entrar</a>
        <button className="btn-primary" onClick={() => { openModal(); setMobileOpen(false); }}>{cms.navbar.ctaText}</button>
      </div>

      {/* HERO */}
      <section id="hero" className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-hero-inner">
          <div>
            <div {...rv()} style={{ display: 'inline-block' }}><div className="lp-hero-label">✦ {cms.hero.label}</div></div>
            <h1 {...rv(1)} className="lp-hero-h1" style={{ fontFamily: "'Sora',sans-serif" }}>
              {cms.hero.headline.split(' ').map((w, i, arr) =>
                i >= arr.length - 2 ? <em key={i}>{(i > 0 ? ' ' : '') + w}</em> : (i > 0 ? ' ' : '') + w
              )}
            </h1>
            <p {...rv(2)} className="lp-hero-sub">{cms.hero.sub}</p>
            <div {...rv(3)} className="lp-hero-btns">
              <button className="btn-primary" onClick={() => go('planos')}>🚀 {cms.hero.cta1}</button>
              <button className="btn-ghost" onClick={() => go('whatsapp')}>▶ {cms.hero.cta2}</button>
            </div>
          </div>
          <div className="lp-phone-wrap">
            <div style={{ position: 'relative' }}>
              <div className="fcard" style={{ top: 30, left: -70 }}>
                <div className="fcard-label">Saldo do mês</div>
                <div className="fcard-value">R$ 8.450</div>
                <div className="fcard-sub"><span className="fcard-dot" />atualizado agora</div>
              </div>
              <div className="lp-phone">
                <div className="lp-phone-inner">
                  <div className="lp-phone-notch"><div className="lp-phone-notch-pill" /></div>
                  <PhoneDashboard />
                </div>
              </div>
              <div className="fcard" style={{ bottom: 90, right: -65 }}>
                <div className="fcard-label">Economia</div>
                <div className="fcard-value">+R$ 820</div>
                <div className="fcard-sub">vs mês passado ↑</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="lp-ticker">
        <div className="lp-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="lp-ticker-item">
              <b>{item.value}</b>
              <span style={{ color: 'var(--border2)', margin: '0 4px' }}>·</span>
              {item.label}
              <span style={{ color: 'rgba(20,185,129,.3)', marginLeft: 20 }}>◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* WHATSAPP */}
      <section id="whatsapp" className="lp-wa-section">
        <div className="lp-wa-inner">
          <div className="lp-wa-phone-wrap"><WaPhone /></div>
          <div>
            <div {...rv()} className="lp-section-tag">{cms.whatsapp.tag}</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif" }}>Lance tudo pelo <em>WhatsApp</em></h2>
            <p {...rv(2)} className="lp-lead">{cms.whatsapp.sub}</p>
            <div {...rv(3)} className="lp-wa-features">
              {(cms.whatsapp.features || []).map((f, i) => (
                <div key={i} className="lp-wa-feat">
                  <div className="lp-wa-feat-icon">{f.icon}</div>
                  <div className="lp-wa-feat-title">{f.title}</div>
                  <div className="lp-wa-feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lp-section">
        <div className="lp-container">
          {(cms.features || []).map((feat, i) => {
            const types = ['dashboard', 'orcamento', 'caixinhas', 'familia'];
            return (
              <div key={i} style={{ marginBottom: i < (cms.features || []).length - 1 ? 96 : 0 }}>
                <div className={`lp-feat-grid${feat.rev ? ' rev' : ''}`}>
                  <div>
                    <div {...rv()} className="lp-section-tag">{feat.tag}</div>
                    <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif" }}>{feat.headline}</h2>
                    <p {...rv(2)} className="lp-lead">{feat.sub}</p>
                    <ul {...rv(3)} className="lp-feat-bullets">{feat.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                  </div>
                  <div {...rv(2)}><FeatVis type={types[i % 4]} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ACTIONS */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div {...rv()} className="lp-section-tag" style={{ justifyContent: 'center' }}>Tudo num só lugar</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif", margin: '0 auto 12px' }}>8 formas de <em>organizar</em> sua vida financeira</h2>
          </div>
          <div {...rv(2)} className="lp-actions-grid">
            {(cms.actions || []).map((a, i) => (
              <div key={i} className="lp-action-card">
                <div className="lp-ac-icon">{a.icon}</div>
                <div className="lp-ac-title">{a.title}</div>
                <div className="lp-ac-desc">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTITUTO WISE MADNESS ────────────────────────────── */}
      <section id="instituto">
        {/* Hero Banner do Instituto */}
        <div className="lp-instituto-hero">
          <div
            className="lp-instituto-hero-bg"
            style={{ backgroundImage: inst.heroImage ? `url(${inst.heroImage})` : 'linear-gradient(135deg,#0a1a14 0%,#0c2a1e 100%)' }}
          />
          <div className="lp-instituto-hero-overlay" />
          <div className="lp-instituto-hero-content">
            <div className="lp-instituto-logo-wrap">
              {inst.logo
                ? <img src={inst.logo} alt={inst.nome} />
                : <span>🎓</span>
              }
            </div>
            <div className="lp-instituto-badge">✦ Nossa parceira social</div>
            <div className="lp-instituto-hero-name" style={{ fontFamily: "'Sora',sans-serif" }}>{inst.nome}</div>
            <div className="lp-instituto-hero-tagline">{inst.tagline}</div>
          </div>
        </div>

        {/* Causa: texto + foto da instituição */}
        <div className="lp-causa-section">
          <div className="lp-causa-inner">
            <div>
              <div {...rv()} className="lp-section-tag">A Nossa Causa</div>
              <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif" }}>
                Educação financeira como <em>transformação social</em>
              </h2>
              <p {...rv(2)} className="lp-lead">{inst.descricao}</p>
              <p {...rv(3)} style={{ fontSize: 14, color: 'var(--muted)', marginTop: 16, lineHeight: 1.7 }}>{inst.missao}</p>
              <div {...rv(4)} className="lp-causa-stats">
                {(inst.stats || []).map((s, i) => (
                  <div key={i} className="lp-causa-stat">
                    <div className="lp-causa-stat-num" style={{ fontFamily: "'Sora',sans-serif" }}>{s.val}</div>
                    <div className="lp-causa-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div {...rv(2)}>
              <div className="lp-causa-photo">
                {inst.fotoInstituicao
                  ? <img src={inst.fotoInstituicao} alt={inst.nome} />
                  : <div className="lp-causa-photo-placeholder">🏫</div>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Galeria de ações sociais */}
        <div className="lp-galeria-section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="lp-galeria-header">
            <div {...rv()} className="lp-section-tag" style={{ justifyContent: 'center' }}>Ações Sociais</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif", margin: '0 auto' }}>
              <em>Momentos</em> que transformam vidas
            </h2>
            <p {...rv(2)} style={{ fontSize: 15, color: 'var(--soft)', maxWidth: 500, margin: '10px auto 0', lineHeight: 1.7 }}>
              Cada foto representa uma história real de jovens que encontraram no conhecimento financeiro uma nova perspectiva de vida.
            </p>
          </div>
          <div {...rv(3)} className="lp-galeria-grid">
            {(inst.galeria || []).map((foto, i) => (
              <div key={i} className="lp-gal-item">
                {foto.url
                  ? <img src={foto.url} alt={foto.caption} />
                  : (
                    <div className="lp-gal-item-placeholder">
                      <span style={{ fontSize: 40 }}>📸</span>
                      <span>Foto {i + 1}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted2)', maxWidth: 120, textAlign: 'center' }}>{foto.caption}</span>
                    </div>
                  )
                }
                {foto.caption && foto.url && <div className="lp-gal-caption">{foto.caption}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Impacto */}
        <div className="lp-impacto-section">
          <div className="lp-impacto-inner">
            <div>
              <div {...rv()} className="lp-section-tag">Nosso Impacto</div>
              <div {...rv(1)} className="lp-impacto-quote" style={{ fontFamily: "'Sora',sans-serif" }}>
                {inst.impactoQuote.split('5%').map((part, i) =>
                  i === 0 ? part : <><em key={i}>5%</em>{part}</>
                )}
              </div>
              <p {...rv(2)} style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>{inst.impactoSub}</p>
            </div>
            <div ref={towerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="lp-impacto-tower">
                {TOWER_HEIGHTS.map((h, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      className={`lp-impacto-bar${towerAnim ? ' anim' : ''}`}
                      style={{ height: h * 1.6 + 'px', transitionDelay: `${i * 0.1}s` }}
                    />
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 5 }}>{2017 + i}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Jovens impactados por ano</p>
            </div>
          </div>
        </div>

        {/* Como você ajuda */}
        <div className="lp-conecta-section">
          <div className="lp-conecta-inner">
            <div {...rv()} className="lp-section-tag" style={{ justifyContent: 'center' }}>Como você contribui</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif", margin: '0 auto' }}>
              Sua assinatura <em>transforma vidas</em>
            </h2>
            <p {...rv(2)} style={{ fontSize: 15, color: 'var(--soft)', maxWidth: 560, margin: '10px auto 0', lineHeight: 1.7 }}>
              A cada assinatura Freedom Premium, automaticamente 5% vai para o Instituto Wise Madness.
            </p>
            <div {...rv(3)} style={{ display: 'flex', justifyContent: 'center', margin: '28px 0' }}>
              <div className="lp-conecta-1pct">
                <div className="lp-conecta-1pct-num">5%</div>
                <div className="lp-conecta-1pct-text">do valor da<br />sua assinatura</div>
              </div>
            </div>
            <div {...rv(4)} className="lp-conecta-flow">
              {[
                { icon: '📱', label: 'Sua assinatura', sub: 'R$19,90/mês' },
                null,
                { icon: '💚', label: '5% doado', sub: '~R$1,00 por mês' },
                null,
                { icon: '📚', label: 'Educação', sub: 'Jovens formados' },
                null,
                { icon: '🌟', label: 'Transformação', sub: 'Famílias livres' },
              ].map((item, i) =>
                item === null
                  ? <div key={i} className="lp-conecta-arrow">→</div>
                  : (
                    <div key={i} className="lp-conecta-node">
                      <div className="lp-conecta-node-icon">{item.icon}</div>
                      <div className="lp-conecta-node-label">{item.label}</div>
                      <div className="lp-conecta-node-sub">{item.sub}</div>
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="lp-section" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div {...rv()} className="lp-section-tag" style={{ justifyContent: 'center' }}>{cms.results.tag}</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif", margin: '0 auto' }}>{cms.results.headline}</h2>
          </div>
          <div {...rv(2)} className="lp-stats-grid">
            {(cms.results.stats || []).map((s, i) => (
              <div key={i}><div className="lp-stat-num" style={{ fontFamily: "'Sora',sans-serif" }}>{s.num}</div><div className="lp-stat-label">{s.label}</div></div>
            ))}
          </div>
          <div className="lp-test-grid">
            {(cms.testimonials || []).map((t, i) => (
              <div key={i} {...rv(i + 1)} className="lp-test-card">
                <div className="lp-test-stars">★★★★★</div>
                <p className="lp-test-text">"{t.text}"</p>
                <div className="lp-test-author">
                  <div className="lp-test-ava">{t.initial}</div>
                  <div><div className="lp-test-name">{t.name}</div><div className="lp-test-role">{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="lp-section" style={{ background: 'radial-gradient(ellipse 100% 50% at 50% 0%,rgba(20,185,129,.06),transparent 60%)', borderTop: '1px solid var(--border)' }}>
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div {...rv()} className="lp-section-tag" style={{ justifyContent: 'center' }}>{cms.plans.tag}</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif", margin: '0 auto 12px' }}>{cms.plans.headline}</h2>
          </div>
          <div {...rv(2)} className="lp-plans-grid">
            {plans.map((plan, i) => (
              <div key={plan.id || i} className={`lp-plan${i === 1 || plan.featured ? ' featured' : ''}`}>
                <div className="lp-plan-name">{plan.name}</div>
                <div className="lp-plan-price-row">
                  {plan.price === 0
                    ? <span className="lp-plan-price" style={{ fontFamily: "'Sora',sans-serif" }}>Grátis</span>
                    : <><span style={{ fontSize: 15, color: 'var(--muted)', alignSelf: 'flex-start', paddingTop: 8 }}>R$</span><span className="lp-plan-price" style={{ fontFamily: "'Sora',sans-serif" }}>{Number(plan.price).toFixed(2).replace('.', ',')}</span><span className="lp-plan-price-suffix">/mês</span></>
                  }
                </div>
                {plan.description && <div className="lp-plan-desc">{plan.description}</div>}
                <ul className="lp-plan-features">
                  {(Array.isArray(plan.features) ? plan.features : []).map((f, j) => <li key={j}>{f}</li>)}
                </ul>
                <button 
                  className={i === 1 || plan.featured ? 'btn-primary' : 'btn-ghost'} 
                  style={{ width: '100%', justifyContent: 'center', opacity: loadingPlan === plan.id ? 0.7 : 1 }} 
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan === plan.id}
                >
                  {loadingPlan === plan.id ? 'Aguarde...' : (plan.price === 0 ? 'Criar conta grátis' : 'Assinar agora')}
                </button>
              </div>
            ))}
          </div>
          <div {...rv(3)} className="lp-guarantee">{cms.plans.guarantee}</div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="lp-section">
        <div className="lp-about-inner">
          <div>
            <div {...rv()} className="lp-section-tag">{cms.about.tag}</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif" }}>{cms.about.headline}</h2>
            <p {...rv(2)} className="lp-lead">{cms.about.sub}</p>
            <div {...rv(3)} style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => go('planos')}>Começar agora</button>
              <button className="btn-ghost" onClick={() => go('planos')}>💬 WhatsApp</button>
            </div>
          </div>
          <div {...rv(2)}>
            <div className="lp-about-card">
              {(cms.about.stats || []).map((s, i) => (
                <div key={i} className="lp-about-stat">
                  <span className="lp-about-stat-label">{s.label}</span>
                  <span className="lp-about-stat-val">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div {...rv()} className="lp-section-tag" style={{ justifyContent: 'center' }}>Perguntas frequentes</div>
            <h2 {...rv(1)} className="lp-h2" style={{ fontFamily: "'Sora',sans-serif", margin: '0 auto' }}>Ficou com <em>dúvidas?</em></h2>
          </div>
          <div {...rv(2)} className="lp-faq-list">
            {(cms.faq || []).map((item, i) => (
              <div key={i} className={`lp-faq-item${faqOpen === i ? ' open' : ''}`}>
                <button className="lp-faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <span>{item.q}</span><span className="lp-faq-chev">⌄</span>
                </button>
                <div className="lp-faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="lp-cta-section">
        <div className="lp-cta-box">
          <h2 {...rv()} style={{ fontFamily: "'Sora',sans-serif" }}>{cms.cta.headline}</h2>
          <p {...rv(1)}>{cms.cta.sub}</p>
          <div {...rv(2)} className="lp-cta-btns">
            <button className="btn-primary" onClick={() => go('planos')}>🚀 {cms.cta.btn}</button>
            <button className="btn-ghost" onClick={() => go('planos')}>💬 Falar no WhatsApp</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="lp-logo" style={{ fontSize: 20 }}>{cms.footer.brand}<span>.</span></div>
            <p className="lp-footer-brand-desc">{cms.footer.desc}</p>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Nos siga nas redes sociais</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { key: 'instagram', label: 'Instagram', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
                  { key: 'facebook', label: 'Facebook', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
                  { key: 'youtube', label: 'YouTube', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg> },
                  { key: 'linkedin', label: 'LinkedIn', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
                  { key: 'whatsapp', label: 'WhatsApp', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> },
                ].map(({ key, label, icon }) => {
                  const href = cms.footer[key];
                  if (!href) return null;
                  return (
                    <a key={key} href={href} target="_blank" rel="noreferrer" title={label}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.07)', color: 'var(--soft)', transition: 'background .2s,color .2s', textDecoration: 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = '#000'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'var(--soft)'; }}
                    >{icon}</a>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="lp-footer-col">
            <h4>Produto</h4>
            <ul>{[['Funcionalidades', 'features'], ['Planos', 'planos'], ['WhatsApp Bot', 'whatsapp']].map(([l, id]) => (<li key={l}><span onClick={() => go(id)}>{l}</span></li>))}</ul>
          </div>
          <div className="lp-footer-col">
            <h4>Instituto</h4>
            <ul>{[['Instituto Wise Madness', 'instituto'], ['Nossa Causa', 'instituto'], ['Impacto', 'instituto']].map(([l, id]) => (<li key={l}><span onClick={() => go(id)}>{l}</span></li>))}</ul>
          </div>
          <div className="lp-footer-col">
            <h4>Legal</h4>
            <ul>{[['Termos de Uso', '#'], ['Privacidade', '#'], ['LGPD', '#']].map(([l, h]) => (<li key={l}><a href={h}>{l}</a></li>))}</ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <p>{cms.footer.disclaimer}</p>
        </div>
      </footer>

      <button className="lp-wa-fab" onClick={() => go('planos')} aria-label="Falar no WhatsApp">💬</button>

      <SignupModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function mergeDeep(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides || {})) {
    if (overrides[key] !== null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = mergeDeep(defaults[key] || {}, overrides[key]);
    } else if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
      result[key] = overrides[key];
    }
  }
  return result;
}

# Hasib AI Agent — বাজারে প্রকাশের প্রস্তুতি তালিকা

সর্বশেষ পর্যালোচনা: ২০২৬-১০-২৫  
প্রধান উৎস: `main` শাখা, Render production/test services, Supabase project `qmdxpvimryxwezqmjbge`।

এই তালিকা একটি release gate। কোনো চেকবক্স কেবল বাস্তব প্রমাণ পাওয়ার পরই সম্পন্ন হিসেবে চিহ্নিত করতে হবে। বর্তমান ব্যবহারকারীর টাস্ক, ইতিহাস, মেমরি বা ডেটাবেস রেকর্ড মুছে ফেলা/পরিবর্তন করা এই কাজের অংশ নয়।

## ১. বর্তমান অবস্থার প্রমাণ

- [x] GitHub repository এবং `main` শাখা অ্যাক্সেস যাচাই করা হয়েছে।
- [x] Render production ও test service শনাক্ত করা হয়েছে।
- [x] Supabase `task-runner` Edge Function সক্রিয়; JWT verification চালু।
- [x] Supabase `social-automation` Edge Function সক্রিয়; বর্তমানে `verify_jwt = false`, তাই এর নিজস্ব callback/state/auth checks এবং প্রতিটি action-এর authorization আলাদাভাবে যাচাই করতে হবে।
- [x] `public.tasks`, `task_history`, `memory_notes`, `approvals`, `activity_log`, `settings`, `notification_preferences`, `app_user_connections` এবং social tables-এ RLS সক্রিয় বলে live schema-তে দেখা গেছে।
- [x] বর্তমান live database snapshot-এ ১১টি task row ও ২১টি task-history row দেখা গেছে। এগুলো অক্ষত রাখতে হবে।
- [x] `app_user_connections` ও social account tables-এ সংযুক্ত অ্যাকাউন্টের row নেই; অতএব UI-তে integration দেখানো মানেই সেটি সংযুক্ত বা কাজ করছে—এমন দাবি করা যাবে না।
- [x] Task Runner-এর অনুমোদিত কাজ বর্তমানে `generate_plan` এবং `create_memory_note`-এ সীমাবদ্ধ।
- [x] README-তে স্পষ্ট করা আছে যে বর্তমান সংস্করণ guarded MVP; এটি unrestricted autonomous browser/account agent নয়।

## ২. প্রকাশের আগে বাধ্যতামূলক নিরাপত্তা গেট

- [ ] Supabase Auth-এ leaked-password protection চালু করা এবং Security Advisor পুনরায় চালানো।
- [ ] `consume_ai_request`, `reserve_ai_token_budget`, `settle_ai_token_budget` SECURITY DEFINER RPC-গুলোর grants, `auth.uid()` checks, fixed `search_path`, allowed arguments এবং quota bypass পরীক্ষার প্রমাণ সংরক্ষণ করা। Advisor warning দেখালেই অন্ধভাবে permission সরানো যাবে না, কারণ অ্যাপের quota enforcement এগুলোর ওপর নির্ভর করে।
- [ ] `social-automation`-এর public endpoint-এ প্রতিটি action-এর authentication/authorization পরীক্ষা করা; OAuth callback-এর state, expiry, single-use behavior ও token handling যাচাই করা।
- [ ] Anonymous access এবং দুই ভিন্ন ব্যবহারকারীর cross-account data access পরীক্ষা করা।
- [ ] প্রকাশের আগে secret scan, CodeQL, build, unit tests এবং Edge Function type-check সব সফল হতে হবে।
- [ ] Gemini ও OAuth credentials কেবল server-side secret store-এ আছে নিশ্চিত করা; কোনো secret `VITE_*`, browser bundle, APK, logs বা Git history-তে রাখা যাবে না।
- [ ] ৫০০,০০০-token rolling budget-কে নির্দিষ্ট USD spending cap হিসেবে উপস্থাপন করা যাবে না; প্রকৃত খরচ-সীমা আলাদাভাবে বাস্তবায়িত ও পরীক্ষা না হলে সেটি অসম্পূর্ণ হিসেবে নথিভুক্ত থাকবে।

## ৩. মূল অ্যাপের end-to-end যাচাই

- [ ] লগইন/লগআউট ও session expiry।
- [ ] Bengali, English ও mixed-language chat; AI provider failure/retry behavior।
- [ ] AI Plan Generator থেকে তৈরি প্ল্যান database-এ সংরক্ষণ এবং পরে পুনরায় দেখা।
- [ ] Task Runner-এ কেবল allowlisted task চালানো; success, retry ও failure status/history/activity log-এ সঠিকভাবে সংরক্ষণ।
- [ ] Memory note তৈরি/পড়া/মুছে ফেলার অনুমতি ও user isolation যাচাই।
- [ ] Approval-required action অনুমোদন ছাড়া কার্যকর হয় না—এটি পরীক্ষা।
- [ ] Search/URL analysis/browser-related feature-এর ক্ষেত্রে প্রকৃত output ও error state যাচাই; শুধু UI control উপস্থিত থাকাকে সম্পূর্ণতা ধরা যাবে না।
- [ ] Activity log ও notifications-এ গোপন token বা সংবেদনশীল provider response প্রকাশ পাচ্ছে না নিশ্চিত করা।

## ৪. বাস্তব ইন্টিগ্রেশন

- [ ] GitHub integration: OAuth/token setup, read-only scope প্রথমে, user-owned repo authorization, এবং explicit approval ছাড়া কোনো write/merge নয়।
- [ ] TinyFish/browser automation: profile/site session, login persistence, timeout/error recovery এবং supported site-এ বাস্তব test।
- [ ] Social publishing: provider developer app, redirect URI, OAuth scopes, secrets ও platform review prerequisites পূরণ; প্রথমে একটি অনুমোদিত test account-এ পরীক্ষা।
- [ ] Facebook/Instagram/YouTube/TikTok/LinkedIn/X/Pinterest/Threads-এর প্রতিটি provider আলাদাভাবে pass না করা পর্যন্ত “সব integration ready” বলা যাবে না।
- [ ] Publishing, external message, delete, spending বা security-sensitive action-এর আগে স্পষ্ট user approval থাকতে হবে।
- [ ] OAuth/provider credentials অনুপস্থিত থাকলে integration-কে “setup required” দেখাতে হবে—“connected” নয়।

## ৫. স্থিতিশীলতা ও প্রকাশযোগ্য UX

- [ ] Render test service-কে আলাদা branch/environment-এ না নেওয়া পর্যন্ত সেটিকে production থেকে বিচ্ছিন্ন staging হিসেবে ধরা যাবে না; বর্তমানে দুটোই `main` ট্র্যাক করে।
- [ ] বর্তমান production deployment ও logs যাচাই করে নির্দিষ্ট commit-কে release candidate হিসেবে চিহ্নিত করা।
- [ ] মোবাইল/ডেস্কটপ layout, empty state, loading state, network error ও offline recovery পরীক্ষা।
- [ ] Android APK build সফল হওয়ার পাশাপাশি বাস্তব ফোনে login, voice, navigation, scrolling, safe-area ও spoken output পরীক্ষা।
- [ ] Privacy Policy, Terms, support/contact, setup guide, known limitations ও data-handling disclosure প্রস্তুত।
- [ ] Developer/customization option-এর সীমা, permissions ও secret-handling নির্দেশিকা নথিভুক্ত।
- [ ] AI usage cap, provider cost, hosting cost, refund/support এবং এককালীন $2–$3 pricing-এর unit economics যাচাই।

## ৬. প্রকাশের ক্রম

1. [ ] Web release candidate: নিরাপত্তা ও end-to-end গেট পাস।
2. [ ] সীমিত ব্যবহারকারী/কম খরচের মাধ্যমে web product validation।
3. [ ] Browser extension: permission-minimal manifest, store review ও site access tests।
4. [ ] Android APK: signing, privacy disclosure, target-device QA ও store requirements।
5. [ ] Marketplace listing, screenshots, demo video, install/setup guide, support policy ও pricing প্রকাশ।

## Release sign-off

Release status: **BLOCKED — প্রমাণভিত্তিক QA ও কিছু নিরাপত্তা/ইন্টিগ্রেশন সেটআপ বাকি।**

কোনো release gate অসম্পূর্ণ থাকলে সেটি স্পষ্টভাবে “অসম্পূর্ণ” হিসেবে দেখাতে হবে। পুরোনো ব্যবহারকারীর ডেটা ধরে রাখা, explicit approval এবং বাস্তব পরীক্ষার প্রমাণ—এই তিনটি শর্ত অগ্রাধিকার পাবে।

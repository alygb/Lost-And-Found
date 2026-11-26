/** English / Urdu text for voice reporting and the "confirm before posting" dialog. */

export type Lang = "en" | "ur";

/** Speech-recognition / speech-synthesis language codes. */
export const SPEECH_LANG: Record<Lang, string> = { en: "en-US", ur: "ur-PK" };

export const REPORT_TEXT = {
  en: {
    voiceTitle: "Report by voice",
    voiceHint: "Just say what happened. We fill in the form for you.",
    langLabel: "Speak in",
    tapToSpeak: "Tap the mic and start speaking",
    listening: "Listening… tap again to stop",
    exampleLost:
      "Example: \"I lost my black leather wallet yesterday near the main bazaar bus stand in Muzaffarabad. It has my CNIC and some cash. My number is 0300 1234567.\"",
    exampleFound:
      "Example: \"I found a blue school bag today outside the district hospital in Mirpur. It has books and a water bottle inside.\"",
    transcriptLabel: "What you said (you can edit or type here)",
    transcriptPlaceholder: "Your words will appear here…",
    fill: "Fill the form",
    filling: "Reading your report…",
    clear: "Clear",
    unsupported: "Voice input is not supported in this browser. Use Chrome or Edge, or type your report in the box below.",
    micDenied: "Microphone access was blocked. Allow the microphone in your browser settings, or type your report below.",
    noSpeech: "We did not hear anything. Please try again and speak clearly.",
    network: "Voice recognition needs an internet connection. Please check your connection, or type your report below.",
    aiFailed: "AI could not read your report. Please fill the form yourself or try again.",
    signin: "Please sign in to use voice reporting.",
    filled: "Filled from your voice. Please check every field below.",
    stillNeeded: "Still needed:",
    nothingFound: "We could not find item details in what you said. Try again with more detail.",
    // Review dialog
    reviewTitle: "Confirm your details",
    reviewSubtitle: "Please check everything carefully. Your report will be posted once you confirm.",
    photos: "Photos",
    noPhotos: "No photos added",
    itemName: "Item",
    category: "Category",
    description: "Description",
    location: "Location",
    place: { lost: "Last seen near", found: "Found near" },
    date: { lost: "Date lost", found: "Date found" },
    map: "Map",
    mapSet: "Marked on map",
    mapNone: "Not marked",
    email: "Email",
    phone: "Phone",
    notGiven: "Not given",
    private: "Private, only you and the admin can see this",
    edit: "Edit details",
    confirm: "Confirm & post",
    posting: "Posting…",
    readAloud: "Read aloud",
    stop: "Stop",
    confirmNote: "I have checked these details and they are correct.",
    tickFirst: "Please tick this box to confirm, then press \"Confirm & post\".",
  },
  ur: {
    voiceTitle: "آواز سے رپورٹ کریں",
    voiceHint: "بس بتائیں کیا ہوا۔ فارم ہم آپ کے لیے بھر دیں گے۔",
    langLabel: "زبان",
    tapToSpeak: "مائیک دبائیں اور بولنا شروع کریں",
    listening: "سن رہے ہیں… روکنے کے لیے دوبارہ دبائیں",
    exampleLost:
      "مثال: \"میرا کالا چمڑے کا بٹوہ کل مظفرآباد میں مین بازار بس اسٹاپ کے قریب گم ہو گیا۔ اس میں میرا شناختی کارڈ اور کچھ پیسے تھے۔ میرا نمبر 03001234567 ہے۔\"",
    exampleFound:
      "مثال: \"مجھے آج میرپور میں ڈسٹرکٹ ہسپتال کے باہر ایک نیلا اسکول بیگ ملا۔ اس میں کتابیں اور پانی کی بوتل ہے۔\"",
    transcriptLabel: "آپ نے جو کہا (آپ یہاں درست کر سکتے ہیں یا لکھ سکتے ہیں)",
    transcriptPlaceholder: "آپ کے الفاظ یہاں نظر آئیں گے…",
    fill: "فارم بھریں",
    filling: "آپ کی رپورٹ پڑھی جا رہی ہے…",
    clear: "صاف کریں",
    unsupported: "یہ براؤزر آواز کی سہولت نہیں دیتا۔ کروم یا ایج استعمال کریں، یا نیچے لکھ دیں۔",
    micDenied: "مائیک کی اجازت نہیں ملی۔ براؤزر کی سیٹنگ میں مائیک کی اجازت دیں، یا نیچے لکھ دیں۔",
    noSpeech: "کوئی آواز سنائی نہیں دی۔ دوبارہ کوشش کریں اور صاف بولیں۔",
    network: "آواز پہچاننے کے لیے انٹرنیٹ ضروری ہے۔ اپنا کنکشن چیک کریں، یا نیچے لکھ دیں۔",
    aiFailed: "رپورٹ پڑھی نہیں جا سکی۔ براہ کرم فارم خود بھریں یا دوبارہ کوشش کریں۔",
    signin: "آواز سے رپورٹ کے لیے پہلے سائن ان کریں۔",
    filled: "آپ کی آواز سے فارم بھر دیا گیا۔ براہ کرم نیچے ہر خانہ چیک کریں۔",
    stillNeeded: "ابھی یہ باقی ہے:",
    nothingFound: "آپ کی بات میں چیز کی تفصیل نہیں ملی۔ مزید تفصیل کے ساتھ دوبارہ کوشش کریں۔",
    // Review dialog
    reviewTitle: "اپنی تفصیلات کی تصدیق کریں",
    reviewSubtitle: "براہ کرم سب کچھ غور سے چیک کریں۔ تصدیق کے بعد آپ کی رپورٹ پوسٹ ہو جائے گی۔",
    photos: "تصاویر",
    noPhotos: "کوئی تصویر نہیں",
    itemName: "چیز",
    category: "قسم",
    description: "تفصیل",
    location: "ضلع",
    place: { lost: "آخری بار کہاں دیکھا", found: "کہاں ملی" },
    date: { lost: "گم ہونے کی تاریخ", found: "ملنے کی تاریخ" },
    map: "نقشہ",
    mapSet: "نقشے پر نشان لگا ہے",
    mapNone: "نشان نہیں لگا",
    email: "ای میل",
    phone: "فون",
    notGiven: "نہیں دیا گیا",
    private: "نجی، صرف آپ اور ایڈمن دیکھ سکتے ہیں",
    edit: "تفصیلات میں ترمیم",
    confirm: "تصدیق کریں اور پوسٹ کریں",
    posting: "پوسٹ ہو رہی ہے…",
    readAloud: "سن کر چیک کریں",
    stop: "روکیں",
    confirmNote: "میں نے یہ تفصیلات چیک کر لی ہیں اور یہ درست ہیں۔",
    tickFirst: "براہ کرم پہلے اس خانے پر نشان لگائیں، پھر \"تصدیق کریں اور پوسٹ کریں\" دبائیں۔",
  },
} as const;

export const CATEGORY_TEXT: Record<Lang, Record<string, string>> = {
  en: {
    electronics: "Electronics", documents: "Documents", clothing: "Clothing", bags: "Bags",
    books: "Books", jewelry: "Jewelry", keys: "Keys", other: "Other",
  },
  ur: {
    electronics: "الیکٹرانکس", documents: "دستاویزات", clothing: "کپڑے", bags: "بیگ",
    books: "کتابیں", jewelry: "زیورات", keys: "چابیاں", other: "دیگر",
  },
};

export const FIELD_TEXT: Record<Lang, Record<string, string>> = {
  en: { itemName: "item name", category: "category", description: "description", district: "district", place: "place", date: "date" },
  ur: { itemName: "چیز کا نام", category: "قسم", description: "تفصیل", district: "ضلع", place: "جگہ", date: "تاریخ" },
};

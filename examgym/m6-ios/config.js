/* Exam Gym ม.6 · ตั้งค่า · ใส่ URL ของ Apps Script (ลงท้าย /exec) ที่ SAVE_URL หลังครูออม Deploy แล้ว */
window.EXAMGYM_CONFIG = {
  SAVE_URL: "https://script.google.com/macros/s/AKfycbzUskZeyoyExG8gUefju4zc0S0FREwEKt3mE_7vPoRIPkoHVIloXR81jc9BvAqdUxLv/exec",
  VERSION: "examgym-m6-ios-multi-2569-10-27-r8dash-t3",
  SCHOOL: "โรงเรียนปิยมิตรวิทยา ฝ่ายมัธยม",
  PREVIEW_WHEN_NO_BACKEND: true,
  // แดชบอร์ดครู (#/admin): รูปนักเรียนปิดไว้ (PDPA · รอครูออมอนุมัติแบบฟอร์มยินยอม) · ห้ามเปิดก่อนอนุมัติ
  DASH_PHOTOS: false,
  // ระบบเข้าสู่ระบบ: 'apps_script' (เดิม · Apps Script + Sheet) | 'firebase' (Firebase Auth + Firestore · ผลยังส่งเข้า Sheet ผ่าน SAVE_URL)
  // สลับกลับได้ทันทีโดยแก้ค่านี้ (rollback)
  AUTH_PROVIDER: "firebase",
  FIREBASE: {
    // ค่าระบุตัวแอปเว็บ (สาธารณะ ไม่ใช่ความลับ) · โปรเจกต์ kruom-examgym-m6
    config: {
      apiKey: "AIzaSyBMGp2M4dfZONGV1qqq0qfzA-53RZncezk",
      authDomain: "kruom-examgym-m6.firebaseapp.com",
      projectId: "kruom-examgym-m6",
      storageBucket: "kruom-examgym-m6.firebasestorage.app",
      messagingSenderId: "364924534034",
      appId: "1:364924534034:web:afee3c0b748638f30547cb"
    },
    SDK_VERSION: "13.1.0",
    STUDENT_EMAIL_DOMAIN: "students.examgym-m6.invalid", // เลขประจำตัว 12345 → 12345@students.examgym-m6.invalid (อีเมลภายใน ไม่มีจริง)
    SHEET_MIRROR: true // ส่งผลเข้า Google Sheet เดิมด้วย (ต้องใช้ Apps Script รุ่นที่รับ Firebase ID token)
  }
};

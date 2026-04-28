# 🚀 MyShop - Development Rules & Guidelines

## ⚠️ Pre-Push Checklist (MANDATORY)

Koi bhi change git push karne se pehle ye sab check karein:

### ✅ Code Quality
- [ ] Full build clear karein (`npm run build` ya equivalent)
- [ ] TypeScript errors nahi hone chahiye
- [ ] Console errors nahi hone chahiye

### ✅ Logic & Permissions
- [ ] Naya feature ke liye permission check kiya?

### ✅ Testing


### ✅ UI/UX
- [ ] Mobile responsive check kiya?
- [ ] Loading states everywhere handle kiye?
- [ ] Error messages clear hain?
UI app se milta julata rehena chhiye

---

## 🔒 Permission Rules

### Important Rules
- **STAFF** ko kabhi cost price nahi dikhna chahiye
- **MANAGER** ko kabhi profit nahi dikhna chahiye
- Har naye feature me permission check lagana ZAROORI ha

---

## 📋 New Feature Checklist

Naya feature add karte waqt:

1. ✅ FeatureRegistry me add karein
2. ✅ roleFeaturePolicy me add karein
4. ✅ Route guard lagayein
5. ✅ Backend controller me permission check lagayein
6. ✅ Test with all roles

---

## 🚫 Git Push Rules

- **MASTER/Main branch par direct push BLOCKED** - Sirf PR se hi push karein
- Har push se pehle pre-push checklist MANDATORY hai
- Code review zaroori hai for new features
bina permition code push nhi hoga

---

## 🔧 Common Issues & Fixes

### UI not showing?
- Console check karein - koi error to nahi?
- Permission check karein - role me feature hai?
- Network tab check karein - API response shi hai?

### Permission error aata hai?
- FeatureRegistry check karein
- roleFeaturePolicy check karein
- User role check karein database me

### Data nahi loading?
- Network tab check karein - koi API call ho rahi?
- Backend logs check karein - error a raha hai?
- Database me data exist karta hai?

### Logic breakdown?
- Console errors check karein
- Console.log lagakar debug karein
- Database queries check karein

---

## 📞 Support

Koi bhi issue aaye to:
1. Console errors check karein
2. Network tab API response check karein
3. Backend terminal logs check karein
4. Database data check karein

---
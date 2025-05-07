const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const usersCollection = db.collection("users");

// 🔎 한글 포함 여부 확인 함수
function containsKorean(text) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

// ✅ 이메일 형식 확인 함수
function isValidEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
}

// ✅ 가입: 한글 이름 ❌, 이메일 형식 ❌이면 저장 금지
exports.registerUser = onRequest(async (req, res) => {
    const { name, email } = req.body;

    if (containsKorean(name)) {
        return res.status(400).send("이름에 한글이 포함되어 있으면 안 됩니다.");
    }

    if (!isValidEmail(email)) {
        return res.status(400).send("이메일 형식이 올바르지 않습니다.");
    }

    const newUser = {
        name,
        email,
        createdAt: new Date(),
    };

    const docRef = await usersCollection.add(newUser);
    return res.status(200).json({ success: true, id: docRef.id });
});

// ✅ 이름으로 유저 조회
exports.getUserByName = onRequest(async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).send("이름을 입력해주세요.");
    }

    const snapshot = await usersCollection.where("name", "==", name).get();

    if (snapshot.empty) {
        return res.status(404).send("해당 이름의 유저를 찾을 수 없습니다.");
    }

    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ users });
});

// ✅ 이메일 수정 (올바른 형식만 허용)
exports.updateEmail = onRequest(async (req, res) => {
    const { userId, newEmail } = req.body;

    if (!isValidEmail(newEmail)) {
        return res.status(400).send("이메일 형식이 올바르지 않습니다.");
    }

    const userDoc = usersCollection.doc(userId);
    await userDoc.update({ email: newEmail });

    return res.status(200).send("이메일이 성공적으로 수정되었습니다.");
});

// ✅ 유저 삭제 (가입 후 1분 지나야 삭제 가능)
exports.deleteUser = onRequest(async (req, res) => {
    const { userId } = req.body;

    const userDoc = await usersCollection.doc(userId).get();

    if (!userDoc.exists) {
        return res.status(404).send("해당 유저를 찾을 수 없습니다.");
    }

    const createdAt = userDoc.data().createdAt.toDate
        ? userDoc.data().createdAt.toDate()
        : new Date(userDoc.data().createdAt);
    const now = new Date();
    const diffInMs = now - createdAt;

    if (diffInMs < 60 * 1000) {
        return res.status(403).send("가입 후 1분이 지나야 삭제할 수 있습니다.");
    }

    await usersCollection.doc(userId).delete();
    return res.status(200).send("유저가 삭제되었습니다.");
});

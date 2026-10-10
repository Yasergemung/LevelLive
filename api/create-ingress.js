import { createClient } from "@supabase/supabase-js";
import { LiveKitAPI, IngressInput } from "livekit-server-sdk";

const ALLOWED_ORIGIN = "https://yasergemung.github.io";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type"
    );
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");

    if (req.headers.origin && req.headers.origin !== ALLOWED_ORIGIN) {
        return res.status(403).json({
            error: "هذا الموقع غير مسموح له باستخدام الخدمة."
        });
    }

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "طريقة الطلب غير مسموح بها."
        });
    }

    const {
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY,
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    } = process.env;

    if (
        !SUPABASE_URL ||
        !SUPABASE_ANON_KEY ||
        !SUPABASE_SERVICE_ROLE_KEY ||
        !LIVEKIT_URL ||
        !LIVEKIT_API_KEY ||
        !LIVEKIT_API_SECRET
    ) {
        return res.status(500).json({
            error: "إعدادات الخادم غير مكتملة."
        });
    }

    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    if (!accessToken) {
        return res.status(401).json({
            error: "يجب تسجيل الدخول أولًا."
        });
    }

    let ingressInfo;

    try {
        // التحقق من هوية المستخدم عبر Supabase
        const authClient = createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );

        const {
            data: { user },
            error: authError
        } = await authClient.auth.getUser(accessToken);

        if (authError || !user) {
            return res.status(401).json({
                error: "جلسة الدخول غير صالحة. سجّل الدخول مجددًا."
            });
        }

        // هذا المفتاح يبقى داخل الخادم فقط
        const adminClient = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );

        const { data: profile, error: profileError } =
            await adminClient
                .from("profiles")
                .select("id, username, display_name, role, creator_approved")
                .eq("id", user.id)
                .single();

        if (profileError || !profile) {
            return res.status(403).json({
                error: "تعذر التحقق من حسابك."
            });
        }

        const approved =
            profile.role === "admin" ||
            (
                profile.role === "creator" &&
                profile.creator_approved === true
            );

        if (!approved) {
            return res.status(403).json({
                error: "يجب الحصول على موافقة الإدارة قبل بدء البث."
            });
        }

        const title =
            typeof req.body?.title === "string"
                ? req.body.title.trim().slice(0, 100)
                : "";

        if (!title) {
            return res.status(400).json({
                error: "اكتب عنوان البث أولًا."
            });
        }

        // إنشاء غرفة منفصلة لهذا البث
        const roomName =
            "levellive-" +
            user.id.replace(/-/g, "").slice(0, 12) +
            "-" +
            Date.now();

        const livekit = new LiveKitAPI({
            host: LIVEKIT_URL,
            apiKey: LIVEKIT_API_KEY,
            secret: LIVEKIT_API_SECRET
        });

        // إنشاء مدخل RTMP لاستخدامه مع OBS
        ingressInfo = await livekit.ingress.createIngress(
            IngressInput.RTMP_INPUT,
            {
                name: title,
                roomName,
                participantIdentity: "streamer-" + user.id,
                participantName:
                    profile.display_name || profile.username || "Creator",
                enableTranscoding: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "تم تجهيز اتصال البث بنجاح.",
            roomName: ingressInfo.roomName,
            ingressId: ingressInfo.ingressId,
            rtmpUrl: ingressInfo.url,
            streamKey: ingressInfo.streamKey
        });

    } catch (error) {
        // لا نطبع المفاتيح أو بيانات الاتصال السرية في السجلات
        console.error("Create ingress failed:", error?.message);

        return res.status(500).json({
            error: "تعذر إنشاء اتصال البث. راجع إعدادات الخادم."
        });
    }
}

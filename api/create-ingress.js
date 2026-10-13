
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
        console.error("Missing required server environment variables.");

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

    try {
        // التحقق من جلسة المستخدم في Supabase
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

        // عميل Supabase بصلاحيات الخادم
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

        // التحقق من صلاحيات الحساب
        const { data: profile, error: profileError } =
            await adminClient
                .from("profiles")
                .select(
                    "id, username, display_name, role, creator_approved"
                )
                .eq("id", user.id)
                .single();

        if (profileError || !profile) {
            console.error(
                "Profile lookup failed:",
                profileError?.message || "Profile not found"
            );

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

        // قراءة بيانات البث
        const title =
            typeof req.body?.title === "string"
                ? req.body.title.trim().slice(0, 100)
                : "";

        const description =
            typeof req.body?.description === "string"
                ? req.body.description.trim().slice(0, 500)
                : "";

        const category =
            typeof req.body?.category === "string"
                ? req.body.category.trim().slice(0, 100)
                : "gaming";

        if (!title) {
            return res.status(400).json({
                error: "اكتب عنوان البث أولًا."
            });
        }

        // إنشاء اسم فريد لغرفة البث
        const roomName =
            "levellive-" +
            user.id.replace(/-/g, "").slice(0, 12) +
            "-" +
            Date.now();

        // إنشاء عميل LiveKit باستخدام بيانات الخادم
        const livekit = new LiveKitAPI({
            host: LIVEKIT_URL.trim(),
            apiKey: LIVEKIT_API_KEY.trim(),
            secret: LIVEKIT_API_SECRET.trim()
        });

        // إنشاء اتصال RTMP
        let ingressInfo;

        try {
            ingressInfo = await livekit.ingress.createIngress(
                IngressInput.RTMP_INPUT,
                {
                    name: title,
                    roomName,
                    participantIdentity: "streamer-" + user.id,
                    participantName:
                        profile.display_name ||
                        profile.username ||
                        "Creator",
                    enableTranscoding: true
                }
            );
        } catch (error) {
            // تسجيل تفاصيل الخطأ في سجل الخادم فقط
            console.error(
                "LiveKit ingress error:",
                error?.message || error
            );

            throw new Error("LIVEKIT_INGRESS_FAILED");
        }

        // حفظ سجل البث في Supabase
        const { data: stream, error: streamError } =
            await adminClient
                .from("streams")
                .insert({
                    creator_id: user.id,
                    title,
                    description,
                    category,
                    provider: "livekit",
                    provider_input_id: ingressInfo.ingressId,
                    room_name: ingressInfo.roomName || roomName,
                    playback_url: null,
                    is_live: false,
                    viewer_count: 0
                })
                .select()
                .single();

        if (streamError) {
            console.error(
                "Supabase stream insert failed:",
                streamError.message
            );

            return res.status(500).json({
                error:
                    "تم إنشاء اتصال البث، لكن تعذر حفظ بيانات البث. " +
                    "لا تحاول إنشاء اتصال آخر قبل مراجعة السجل."
            });
        }

        // إعادة بيانات اتصال البث لصانع المحتوى
        return res.status(200).json({
            success: true,
            message: "تم تجهيز اتصال البث بنجاح.",
            streamId: stream.id,
            roomName: ingressInfo.roomName || roomName,
            ingressId: ingressInfo.ingressId,
            rtmpUrl: ingressInfo.url,
            streamKey: ingressInfo.streamKey
        });

    } catch (error) {
        console.error(
            "Create ingress failed:",
            error?.message || error
        );

        return res.status(500).json({
            error:
                error?.message === "LIVEKIT_INGRESS_FAILED"
                    ? "فشل LiveKit في إنشاء اتصال البث. راجع سجل Vercel."
                    : "تعذر إنشاء اتصال البث. راجع إعدادات الخادم."
        });
    }
}

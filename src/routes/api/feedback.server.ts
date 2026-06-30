import { json } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supabase } from "@/integrations/supabase/client";
import { put } from "@vercel/blob";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = "ngoc.ltnanh@gmail.com";

export async function POST(request: Request) {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const type = formData.get("type") as string;
    const email = formData.get("email") as string;
    const attachment = formData.get("attachment") as File | null;

    // Validate inputs
    if (!title || !content || !type || !email) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    let attachmentUrl: string | null = null;

    // Upload attachment if provided
    if (attachment && attachment.size > 0) {
      try {
        const fileName = `feedback-${user.id}-${Date.now()}-${attachment.name}`;
        const blob = await put(fileName, attachment, {
          access: "private",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        attachmentUrl = blob.url;
      } catch (error) {
        console.error("Failed to upload attachment:", error);
        // Continue without attachment rather than failing
      }
    }

    // Save feedback to database using service role
    const { data: feedback, error: dbError } = await supabaseAdmin
      .from("feedbacks")
      .insert({
        user_id: user.id,
        title,
        content,
        type,
        email,
        attachment_url: attachmentUrl,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return json({ error: "Failed to save feedback" }, { status: 500 });
    }

    // Send email to admin
    try {
      const typeLabel = {
        bug: "Báo lỗi",
        feature: "Đề xuất tính năng",
        design: "Giao diện",
        other: "Khác",
      }[type] || type;

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Góp ý mới từ ứng dụng</h2>
          
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 8px 0;">
              <strong>Tiêu đề:</strong> ${title}
            </p>
            <p style="margin: 8px 0;">
              <strong>Loại:</strong> <span style="background: #e0e7ff; padding: 4px 8px; border-radius: 4px;">${typeLabel}</span>
            </p>
            <p style="margin: 8px 0;">
              <strong>Email:</strong> ${email}
            </p>
            <p style="margin: 8px 0;">
              <strong>Thời gian:</strong> ${new Date().toLocaleString("vi-VN")}
            </p>
          </div>

          <h3 style="margin-top: 20px; margin-bottom: 8px;">Nội dung:</h3>
          <p style="white-space: pre-wrap; background: #fafafa; padding: 12px; border-left: 4px solid #2563eb; border-radius: 4px;">
            ${content}
          </p>

          ${attachmentUrl ? `<p style="margin-top: 16px;"><strong>Ảnh đính kèm:</strong> <a href="${attachmentUrl}" style="color: #2563eb; text-decoration: none;">${attachmentUrl}</a></p>` : ""}

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #666; font-size: 12px;">ID Góp ý: ${feedback.id}</p>
        </div>
      `;

      await resend.emails.send({
        from: "Easy Eats & Earnings <onboarding@resend.dev>",
        to: ADMIN_EMAIL,
        replyTo: email,
        subject: `[Góp ý] ${title}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't fail the request if email fails
    }

    return json({
      success: true,
      id: feedback.id,
      message: "Góp ý đã được gửi thành công",
    });
  } catch (error) {
    console.error("API error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

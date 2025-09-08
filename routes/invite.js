import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

router.post("/", async (req, res) => {
  const { email, boardId } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const boardLink = `${process.env.FRONTEND_URL}/board/${boardId}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Board App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "You've been invited to a board",
      html: `<p>You have been invited to collaborate on a board.</p>
                    <p><a href="${boardLink}">Click here to open the board</a></p>`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

export default router;

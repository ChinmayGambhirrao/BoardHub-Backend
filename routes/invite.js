const express = require("express");
const nodemailer = require("nodemailer");
const Board = require("../models/Board");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const auth = require("../middleware/auth");

const router = express.Router();

// @desc    Send board invitation via email
// @route   POST /api/invite
// @access  Private
router.post("/", auth, async (req, res) => {
  const { email, boardId, role = "member" } = req.body;

  if (!email || !boardId) {
    return res.status(400).json({ error: "Email and boardId are required" });
  }

  try {
    // Find the board
    const board = await Board.findById(boardId).populate("owner", "name email");
    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    // Check if user is owner or admin
    if (
      !board.owner._id.equals(req.user._id) &&
      !board.members.some(
        (member) => member.user.equals(req.user._id) && member.role === "admin"
      )
    ) {
      return res.status(403).json({ error: "Not authorized to invite users" });
    }

    // Check if user is already a member
    const existingUser = await User.findOne({ email });
    if (
      existingUser &&
      board.members.some((member) => member.user.equals(existingUser._id))
    ) {
      return res
        .status(400)
        .json({ error: "User is already a member of this board" });
    }

    // Check for existing pending invitation; if found, extend expiry and reuse
    let invitation = await Invitation.findOne({
      email,
      board: boardId,
      status: "pending",
    });

    if (invitation) {
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await invitation.save();
    } else {
      // Create invitation
      invitation = new Invitation({
        email,
        board: boardId,
        invitedBy: req.user._id,
        role,
      });
      await invitation.save();
    }

    // Send email
    const invitationLink = `${process.env.FRONTEND_URL}/invite/${invitation.token}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're invited to collaborate on a board</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 300; }
            .content { padding: 30px; }
            .board-preview { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; margin: 20px 0; }
            .board-title { font-size: 18px; font-weight: 600; color: #2c3e50; margin-bottom: 10px; }
            .board-description { color: #6c757d; margin-bottom: 15px; }
            .board-meta { display: flex; gap: 20px; font-size: 14px; color: #6c757d; }
            .cta-button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .cta-button:hover { background: #0056b3; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
            .sender-info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
            .expiry-notice { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 15px 0; font-size: 14px; color: #856404; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 You're Invited to Collaborate!</h1>
                <p>Join a board and start collaborating with your team</p>
            </div>
            
            <div class="content">
                <div class="sender-info">
                    <strong>${
                      board.owner.name
                    }</strong> has invited you to collaborate on a board.
                </div>
                
                <div class="board-preview">
                    <div class="board-title">${board.title}</div>
                    ${
                      board.description
                        ? `<div class="board-description">${board.description}</div>`
                        : ""
                    }
                    <div class="board-meta">
                        <span>👥 ${board.members.length + 1} members</span>
                        <span>📋 ${board.lists.length} lists</span>
                        <span>🔧 ${role} access</span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${invitationLink}" class="cta-button">Accept Invitation & Join Board</a>
                </div>
                
                <div class="expiry-notice">
                    ⏰ This invitation will expire in 7 days. Click the button above to accept it.
                </div>
                
                <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
                    If the button doesn't work, you can copy and paste this link into your browser:<br>
                    <a href="${invitationLink}" style="color: #007bff; word-break: break-all;">${invitationLink}</a>
                </p>
            </div>
            
            <div class="footer">
                <p>This invitation was sent by BoardHub. If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
      from: `"BoardHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `You're invited to collaborate on "${board.title}"`,
      html: emailHtml,
    });

    res.json({
      success: true,
      message: `Invitation sent to ${email}`,
      invitationId: invitation._id,
    });
  } catch (error) {
    console.error("Invitation error:", error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// @desc    Accept board invitation
// @route   GET /api/invite/:token
// @access  Public
router.get("/:token", async (req, res) => {
  try {
    const invitation = await Invitation.findOne({
      token: req.params.token,
      status: "pending",
    })
      .populate("board", "title description")
      .populate("invitedBy", "name");

    if (!invitation) {
      return res.status(404).json({ error: "Invalid or expired invitation" });
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return res.status(410).json({ error: "Invitation has expired" });
    }

    res.json({
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        board: invitation.board,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    res.status(500).json({ error: "Failed to get invitation details" });
  }
});

// @desc    Accept board invitation
// @route   POST /api/invite/:token/accept
// @access  Public
router.post("/:token/accept", async (req, res) => {
  try {
    const invitation = await Invitation.findOne({
      token: req.params.token,
      status: "pending",
    }).populate("board");

    if (!invitation) {
      return res.status(404).json({ error: "Invalid or expired invitation" });
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return res.status(410).json({ error: "Invitation has expired" });
    }

    // Find or create user
    let user = await User.findOne({ email: invitation.email });
    if (!user) {
      // Create a new user account
      user = new User({
        name: invitation.email.split("@")[0], // Use email prefix as name
        email: invitation.email,
        // No password - they'll need to set one later
      });
      await user.save();
    }

    // Check if user is already a member
    const board = invitation.board;
    if (board.members.some((member) => member.user.equals(user._id))) {
      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      await invitation.save();
      return res
        .status(400)
        .json({ error: "User is already a member of this board" });
    }

    // Add user to board
    board.members.push({
      user: user._id,
      role: invitation.role,
    });

    // Add activity log
    board.activity.push({
      type: "member_invite_accepted",
      user: user._id,
      description: `${user.name} accepted the invitation to join the board`,
    });

    await board.save();

    // Mark invitation as accepted
    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    res.json({
      success: true,
      message: "Successfully joined the board",
      boardId: board._id,
      userId: user._id,
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

module.exports = router;

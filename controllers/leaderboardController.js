const User = require('../models/User');

exports.getLeaderboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Include friends and the user themselves
    const idsToInclude = [...currentUser.friends, currentUser._id];

    const users = await User.find({ _id: { $in: idsToInclude } })
      .select('nick globalPoints totalGamePoints')
      .lean();

    // Compute totalScore server-side and sort descending
    const ranked = users
      .map(u => ({
        id: u._id,
        nick: u.nick,
        globalPoints: u.globalPoints || 0,
        totalGamePoints: u.totalGamePoints || 0,
        totalScore: (u.totalGamePoints || 0) + (u.globalPoints || 0),
        isCurrentUser: u._id.toString() === userId.toString()
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((u, index) => ({ ...u, rank: index + 1 }));

    res.status(200).json({ leaderboard: ranked });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

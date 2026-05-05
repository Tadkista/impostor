const User = require('../models/User');

exports.addFriend = async (req, res) => {
  try {
    const { friendCode } = req.body;
    const userId = req.user.userId;

    if (!friendCode) {
      return res.status(400).json({ message: 'Friend code is required' });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: 'Current user not found' });

    if (currentUser.friendCode === friendCode) {
      return res.status(400).json({ message: 'Cannot add yourself as a friend' });
    }

    const friendToAdd = await User.findOne({ friendCode });
    if (!friendToAdd) {
      return res.status(404).json({ message: 'User with this friend code not found' });
    }

    if (currentUser.friends.includes(friendToAdd._id)) {
      return res.status(400).json({ message: 'User is already your friend' });
    }

    // Bidirectional friendship
    currentUser.friends.push(friendToAdd._id);
    friendToAdd.friends.push(currentUser._id);

    await currentUser.save();
    await friendToAdd.save();

    res.status(200).json({ message: 'Friend added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate('friends', 'name nick friendCode globalPoints');
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ friends: user.friends });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

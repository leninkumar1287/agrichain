const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost:5432/organic_certification', {
  dialect: 'postgres',
  logging: false
});

const User = sequelize.define('User', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  username: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  mobile: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  role: {
    type: Sequelize.ENUM('farmer', 'inspector', 'certificate_issuer'),
    allowNull: false
  },
  walletAddress: {
    type: Sequelize.STRING,
    allowNull: true
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

const CertificationRequest = sequelize.define('CertificationRequest', {
  requestId: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  productName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  description: {
    type: Sequelize.TEXT,
    allowNull: false
  },
  status: {
    type: Sequelize.ENUM('pending', 'in_progress', 'approved', 'rejected', 'certified'),
    defaultValue: 'pending'
  },
  blockchainRequestId: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  blockchainTransactions: {
    type: Sequelize.JSONB,
    defaultValue: {
      farmer: {
        initiated: null,
        reverted: null
      },
      inspector: {
        in_progress: null,
        approved: null,
        rejected: null
      },
      certificate_issuer: {
        certified: null
      }
    }
  }
});

const Media = sequelize.define('Media', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  type: {
    type: Sequelize.ENUM('image', 'video'),
    allowNull: false
  },
  url: {
    type: Sequelize.STRING,
    allowNull: false
  },
  hash: {
    type: Sequelize.STRING,
    allowNull: false
  }
});

const Checkpoint = sequelize.define('Checkpoint', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  requestId: { type: Sequelize.UUID, allowNull: false },
  checkpointId: { type: Sequelize.INTEGER, allowNull: false },
  answer: { type: Sequelize.STRING, allowNull: false },
  mediaUrl: { type: Sequelize.STRING }
}, {
  tableName: 'Checkpoints',
  underscored: false,
  timestamps: false
});

const DhiwayCertificate = sequelize.define('DhiwayCertificate', {
  "requestId": {
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false,
    references: {
      model: 'CertificationRequests',
      key: 'requestId'
    },
    field: 'requestId'
  },
  "dhiwayResponse": {
    type: Sequelize.JSONB,
    allowNull: false,
    field: 'dhiwayResponse'
  }
}, {
  tableName: 'DhiwayCertificates',
  timestamps: false // <--- disables createdAt/updatedAt
});


// Define relationships
User.hasMany(CertificationRequest, { foreignKey: 'farmerId' });
CertificationRequest.belongsTo(User, { as: 'farmer', foreignKey: 'farmerId' });
CertificationRequest.belongsTo(User, { as: 'inspector', foreignKey: 'inspectorId' });
CertificationRequest.belongsTo(User, { as: 'certifier', foreignKey: 'certifierId' });
CertificationRequest.hasMany(Media, { foreignKey: 'requestId' });
Media.belongsTo(CertificationRequest, { foreignKey: 'requestId' });
CertificationRequest.hasMany(Checkpoint, { foreignKey: 'requestId' });
Checkpoint.belongsTo(CertificationRequest, { foreignKey: 'requestId' });
DhiwayCertificate.belongsTo(CertificationRequest, { foreignKey: 'requestId', targetKey: 'requestId' });
CertificationRequest.hasOne(DhiwayCertificate, { foreignKey: 'requestId', sourceKey: 'requestId' });


module.exports = {
  sequelize,
  User,
  CertificationRequest,
  Media,
  Checkpoint,
  DhiwayCertificate
}; 
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

class Media extends Model {}

Media.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  requestId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'CertificationRequests',
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'Media',
  tableName: 'Media'
});

module.exports = Media; 
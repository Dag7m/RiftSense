const SensorNodeModel = require('../models/sensorNode.model');
const SensorDataModel = require('../models/sensorData.model');
const EventModel = require('../models/event.model');
const FeltReportModel = require('../models/feltReport.model');
const UserModel = require('../models/user.model');
const PredictionModel = require('../models/prediction.model');
const AdminLogModel = require('../models/adminLog.model');
const { getHypertableStats, getChunkInfo } = require('../config/timescale');
const logger = require('../utils/logger');
const { isValidUUID } = require('../utils/validators');
const mlClient = require('../utils/mlClient');

/**
 * Admin Controller
 * 
 * Handles administrative functions: node management, statistics, and audit logs.
 */

/**
 * Log admin action
 */
async function logAdminAction(adminId, action, resourceType, resourceId, details, ipAddress) {
  try {
    await AdminLogModel.create({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ipAddress
    });
  } catch (error) {
    logger.error('Failed to log admin action:', error);
  }
}

// ========================================
// Sensor Node Management
// ========================================

/**
 * Register a new sensor node
 * POST /api/admin/nodes
 */
async function createNode(req, res) {
  try {
    const { node_id, name, latitude, longitude, elevation, firmware_version } = req.body;

    // Check if node_id already exists
    const existingNode = await SensorNodeModel.findByNodeId(node_id);
    if (existingNode) {
      return res.status(409).json({
        success: false,
        error: `Sensor node '${node_id}' already exists`
      });
    }

    const node = await SensorNodeModel.create({
      node_id,
      name,
      latitude,
      longitude,
      elevation,
      status: 'active',
      firmware_version
    });

    // Log action
    await logAdminAction(
      req.user.id,
      'CREATE',
      'sensor_node',
      node.id,
      { node_id, name, latitude, longitude },
      req.ip
    );

    logger.info(`Sensor node created: ${node_id} by admin ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: node,
      message: 'Sensor node registered successfully'
    });
  } catch (error) {
    logger.error('Error creating sensor node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sensor node'
    });
  }
}

/**
 * Update a sensor node
 * PUT /api/admin/nodes/:nodeId
 */
async function updateNode(req, res) {
  try {
    const { nodeId } = req.params;
    const updateData = req.body;

    let node;
    if (isValidUUID(nodeId)) {
      node = await SensorNodeModel.findById(nodeId);
    } else {
      node = await SensorNodeModel.findByNodeId(nodeId);
    }

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Sensor node not found'
      });
    }

    const updatedNode = await SensorNodeModel.update(node.id, updateData);

    // Log action
    await logAdminAction(
      req.user.id,
      'UPDATE',
      'sensor_node',
      node.id,
      { updates: updateData },
      req.ip
    );

    logger.info(`Sensor node updated: ${node.node_id} by admin ${req.user.email}`);

    res.json({
      success: true,
      data: updatedNode,
      message: 'Sensor node updated successfully'
    });
  } catch (error) {
    logger.error('Error updating sensor node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sensor node'
    });
  }
}

/**
 * Deactivate a sensor node (soft delete)
 * DELETE /api/admin/nodes/:nodeId
 */
async function deactivateNode(req, res) {
  try {
    const { nodeId } = req.params;

    let node;
    if (isValidUUID(nodeId)) {
      node = await SensorNodeModel.findById(nodeId);
    } else {
      node = await SensorNodeModel.findByNodeId(nodeId);
    }

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Sensor node not found'
      });
    }

    const deactivatedNode = await SensorNodeModel.deactivate(node.id);

    // Log action
    await logAdminAction(
      req.user.id,
      'DEACTIVATE',
      'sensor_node',
      node.id,
      { node_id: node.node_id },
      req.ip
    );

    logger.info(`Sensor node deactivated: ${node.node_id} by admin ${req.user.email}`);

    res.json({
      success: true,
      data: deactivatedNode,
      message: 'Sensor node deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating sensor node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate sensor node'
    });
  }
}

/**
 * Get all sensor nodes with details
 * GET /api/admin/nodes
 */
async function getAllNodes(req, res) {
  try {
    const { status, page, limit } = req.query;

    const offset = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 100);
    
    const nodes = await SensorNodeModel.findAll({
      status,
      limit: parseInt(limit) || 100,
      offset
    });

    const total = await SensorNodeModel.count({ status });

    // Get offline nodes
    const offlineNodes = await SensorNodeModel.findOffline(5);

    res.json({
      success: true,
      data: {
        nodes,
        offline_count: offlineNodes.length,
        total,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 100,
          total,
          totalPages: Math.ceil(total / (parseInt(limit) || 100))
        }
      }
    });
  } catch (error) {
    logger.error('Error getting all nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sensor nodes'
    });
  }
}

// ========================================
// System Statistics
// ========================================

/**
 * Get system statistics
 * GET /api/admin/stats
 */
async function getSystemStats(req, res) {
  try {
    const { days } = req.query;
    const daysPeriod = parseInt(days) || 30;

    // Get counts
    const [
      nodeCount,
      activeNodeCount,
      eventStats,
      feltStats,
      predictionStats,
      userCount,
      adminCount
    ] = await Promise.all([
      SensorNodeModel.count(),
      SensorNodeModel.count({ status: 'active' }),
      EventModel.getStatistics(daysPeriod),
      FeltReportModel.getStatistics(daysPeriod),
      PredictionModel.getStatistics(daysPeriod),
      UserModel.count(),
      UserModel.count({ role: 'admin' })
    ]);

    // Get TimescaleDB stats
    let hypertableStats = null;
    try {
      hypertableStats = await getHypertableStats();
    } catch (err) {
      logger.warn('Could not get hypertable stats:', err.message);
    }

    // Get recent data count
    const networkStats = await SensorDataModel.getNetworkStats(60); // Last hour

    res.json({
      success: true,
      data: {
        nodes: {
          total: nodeCount,
          active: activeNodeCount,
          offline: nodeCount - activeNodeCount
        },
        events: eventStats,
        felt_reports: feltStats,
        predictions: predictionStats,
        users: {
          total: userCount,
          admins: adminCount,
          regular: userCount - adminCount
        },
        network: {
          active_nodes_with_data: networkStats.length,
          nodes_reporting: networkStats
        },
        database: {
          hypertable: hypertableStats
        },
        period_days: daysPeriod
      }
    });
  } catch (error) {
    logger.error('Error getting system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system statistics'
    });
  }
}

/**
 * Get dashboard data
 * GET /api/admin/dashboard
 */
async function getDashboard(req, res) {
  try {
    // Get recent events
    const recentEvents = await EventModel.findRecent(24, 10);

    // Get recent felt reports
    const recentReports = await FeltReportModel.findRecent(24, 10);

    // Get offline nodes
    const offlineNodes = await SensorNodeModel.findOffline(5);

    // Get quick stats
    const [totalEvents, confirmedEvents, totalReports] = await Promise.all([
      EventModel.count(),
      EventModel.count({ status: 'confirmed' }),
      FeltReportModel.count()
    ]);

    res.json({
      success: true,
      data: {
        recent_events: recentEvents,
        recent_reports: recentReports,
        offline_nodes: offlineNodes,
        quick_stats: {
          total_events: totalEvents,
          confirmed_events: confirmedEvents,
          total_felt_reports: totalReports,
          offline_node_count: offlineNodes.length
        }
      }
    });
  } catch (error) {
    logger.error('Error getting dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
}

// ========================================
// Audit Logs
// ========================================

/**
 * Get admin audit logs
 * GET /api/admin/logs
 */
async function getAuditLogs(req, res) {
  try {
    const { 
      page, 
      limit, 
      admin_id, 
      action, 
      resource_type,
      start_date,
      end_date 
    } = req.query;

    const result = await AdminLogModel.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      admin_id,
      action,
      resource_type,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit logs'
    });
  }
}

/**
 * Get recent admin activity
 * GET /api/admin/logs/recent
 */
async function getRecentActivity(req, res) {
  try {
    const { hours, limit } = req.query;

    const logs = await AdminLogModel.findRecent(
      parseInt(hours) || 24,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('Error getting recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent activity'
    });
  }
}

// ========================================
// User Management
// ========================================

/**
 * Get all users
 * GET /api/admin/users
 */
async function getUsers(req, res) {
  try {
    const { page, limit, role } = req.query;

    const result = await UserModel.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      role
    });

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
}

/**
 * Update user role or status
 * PUT /api/admin/users/:userId
 */
async function updateUser(req, res) {
  try {
    const { userId } = req.params;
    const { role, is_active, name } = req.body;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Prevent self-modification of critical fields
    if (userId === req.user.id && (role !== undefined || is_active !== undefined)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify your own role or status'
      });
    }

    const user = await UserModel.update(userId, { role, is_active, name });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Log action
    await logAdminAction(
      req.user.id,
      'UPDATE',
      'user',
      userId,
      { updates: { role, is_active, name } },
      req.ip
    );

    logger.info(`User ${userId} updated by admin ${req.user.email}`);

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
}

/**
 * Deactivate a user
 * DELETE /api/admin/users/:userId
 */
async function deactivateUser(req, res) {
  try {
    const { userId } = req.params;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Prevent self-deactivation
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
    }

    const user = await UserModel.deactivate(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Log action
    await logAdminAction(
      req.user.id,
      'DEACTIVATE',
      'user',
      userId,
      { email: user.email },
      req.ip
    );

    logger.info(`User ${user.email} deactivated by admin ${req.user.email}`);

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate user'
    });
  }
}

// ========================================
// Database Management
// ========================================

/**
 * Get database information
 * GET /api/admin/database
 */
async function getDatabaseInfo(req, res) {
  try {
    const hypertableStats = await getHypertableStats();
    const chunkInfo = await getChunkInfo();
    const totalSensorData = await SensorDataModel.totalCount();

    res.json({
      success: true,
      data: {
        hypertable: hypertableStats,
        chunks: chunkInfo,
        total_sensor_readings: totalSensorData
      }
    });
  } catch (error) {
    logger.error('Error getting database info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database information'
    });
  }
}

/**
 * Cleanup old data
 * POST /api/admin/cleanup
 */
async function cleanupOldData(req, res) {
  try {
    const { sensor_days, prediction_days, log_days } = req.body;

    const results = {
      sensor_data_deleted: 0,
      predictions_deleted: 0,
      logs_deleted: 0
    };

    if (sensor_days) {
      results.sensor_data_deleted = await SensorDataModel.deleteOld(parseInt(sensor_days));
    }

    if (prediction_days) {
      results.predictions_deleted = await PredictionModel.deleteOld(parseInt(prediction_days));
    }

    if (log_days) {
      results.logs_deleted = await AdminLogModel.deleteOld(parseInt(log_days));
    }

    // Log action
    await logAdminAction(
      req.user.id,
      'CLEANUP',
      'database',
      null,
      { sensor_days, prediction_days, log_days, results },
      req.ip
    );

    logger.info(`Database cleanup by admin ${req.user.email}:`, results);

    res.json({
      success: true,
      data: results,
      message: 'Cleanup completed successfully'
    });
  } catch (error) {
    logger.error('Error cleaning up data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old data'
    });
  }
}

// ========================================
// ML Predictions
// ========================================

/**
 * List ML predictions with pagination and optional filters.
 * GET /api/admin/predictions
 *
 * Query params: page, limit, prediction, min_confidence, node_id
 */
async function getPredictions(req, res) {
  try {
    const {
      page,
      limit,
      prediction,
      min_confidence,
      node_id
    } = req.query;

    const result = await PredictionModel.findAll({
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 50, 200),
      prediction: prediction || null,
      min_confidence: min_confidence ? parseFloat(min_confidence) : null,
      node_id: node_id || null
    });

    res.json({
      success: true,
      data: result.predictions,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error getting predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get predictions'
    });
  }
}

/**
 * Aggregate prediction stats (class counts, avg confidence, etc.).
 * GET /api/admin/predictions/stats
 *
 * Query params: days (default 7)
 */
async function getPredictionStats(req, res) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const [overall, byModelVersion] = await Promise.all([
      PredictionModel.getStatistics(days),
      PredictionModel.getModelVersionStats()
    ]);

    res.json({
      success: true,
      data: {
        window_days: days,
        overall,
        by_model_version: byModelVersion
      }
    });
  } catch (error) {
    logger.error('Error getting prediction stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prediction statistics'
    });
  }
}

/**
 * ML service / placeholder health.
 * GET /api/admin/ml/health
 */
async function getMlHealth(req, res) {
  try {
    const health = await mlClient.healthCheck();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error getting ML health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ML health'
    });
  }
}

module.exports = {
  // Node management
  createNode,
  updateNode,
  deactivateNode,
  getAllNodes,
  
  // Statistics
  getSystemStats,
  getDashboard,
  
  // Audit logs
  getAuditLogs,
  getRecentActivity,
  
  // User management
  getUsers,
  updateUser,
  deactivateUser,
  
  // Database
  getDatabaseInfo,
  cleanupOldData,

  // ML predictions
  getPredictions,
  getPredictionStats,
  getMlHealth
};


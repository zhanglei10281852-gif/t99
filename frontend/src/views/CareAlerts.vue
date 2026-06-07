<template>
  <div class="page">
    <div class="page-header">
      <h2>关爱预警中心</h2>
      <div class="header-actions">
        <a-button type="primary" @click="handleScan" :loading="scanning" v-if="isAdmin">
          <ScanOutlined />
          立即扫描
        </a-button>
      </div>
    </div>

    <a-row :gutter="16" class="stats-row">
      <a-col :span="6">
        <a-card class="stat-card red">
          <div class="stat-content">
            <div class="stat-label">红色预警</div>
            <div class="stat-value">{{ alertSummary.red }}</div>
          </div>
          <div class="stat-icon">
            <WarningOutlined />
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card orange">
          <div class="stat-content">
            <div class="stat-label">橙色预警</div>
            <div class="stat-value">{{ alertSummary.orange }}</div>
          </div>
          <div class="stat-icon">
            <ExclamationCircleOutlined />
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card yellow">
          <div class="stat-content">
            <div class="stat-label">黄色预警</div>
            <div class="stat-value">{{ alertSummary.yellow }}</div>
          </div>
          <div class="stat-icon">
            <BellOutlined />
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card blue">
          <div class="stat-content">
            <div class="stat-label">待处理任务</div>
            <div class="stat-value">{{ taskSummary.pending + taskSummary.inProgress }}</div>
          </div>
          <div class="stat-icon">
            <FileTextOutlined />
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card>
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
        <a-tab-pane key="alerts" tab="预警列表">
          <div class="tab-toolbar">
            <a-space>
              <a-select
                v-model:value="queryForm.level"
                placeholder="全部等级"
                style="width: 120px"
                allow-clear
                @change="handleSearch"
              >
                <a-select-option value="red">红色</a-select-option>
                <a-select-option value="orange">橙色</a-select-option>
                <a-select-option value="yellow">黄色</a-select-option>
              </a-select>
              <a-select
                v-model:value="queryForm.status"
                placeholder="全部状态"
                style="width: 120px"
                allow-clear
                @change="handleSearch"
              >
                <a-select-option value="pending">待处理</a-select-option>
                <a-select-option value="processing">处理中</a-select-option>
                <a-select-option value="resolved">已解决</a-select-option>
                <a-select-option value="closed">已关闭</a-select-option>
              </a-select>
            </a-space>
          </div>

          <a-table
            :columns="alertColumns"
            :data-source="alertList"
            :pagination="alertPagination"
            :loading="loading"
            row-key="_id"
            @change="handleAlertTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'level'">
                <a-tag :color="getLevelColor(record.level)" style="font-weight: bold">
                  {{ getLevelText(record.level) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'elderly'">
                <div class="elderly-info">
                  <div class="name">
                    {{ record.elderlyId?.name || '-' }}
                    <a-tag v-if="record.elderlyId?.isAlone" color="orange" style="margin-left: 8px">独居</a-tag>
                    <a-tag v-if="record.elderlyId?.age >= 80" color="red">高龄</a-tag>
                  </div>
                  <div class="meta">
                    {{ record.elderlyId?.age }}岁 · {{ record.elderlyId?.community }}
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'reason'">
                <div>
                  <div>连续 {{ record.reason?.consecutiveDays }} 天未就餐</div>
                  <div class="meta">
                    规律: {{ getPatternText(record.reason?.patternType) }}
                    · 阈值: {{ record.reason?.thresholdDays }}天
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'triggeredAt'">
                {{ formatDateTime(record.triggeredAt) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space>
                  <a-button type="link" @click="viewAlertDetail(record)">查看</a-button>
                  <a-button
                    type="link"
                    @click="handleDispatchTask(record)"
                    v-if="record.status === 'pending'"
                  >
                    派发任务
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="tasks" tab="关爱任务">
          <div class="tab-toolbar">
            <a-space>
              <a-select
                v-model:value="taskQueryForm.status"
                placeholder="全部状态"
                style="width: 120px"
                allow-clear
                @change="handleTaskSearch"
              >
                <a-select-option value="pending">待派发</a-select-option>
                <a-select-option value="in_progress">处理中</a-select-option>
                <a-select-option value="completed">已完成</a-select-option>
                <a-select-option value="escalated">已升级</a-select-option>
              </a-select>
              <a-select
                v-model:value="taskQueryForm.priority"
                placeholder="全部优先级"
                style="width: 120px"
                allow-clear
                @change="handleTaskSearch"
              >
                <a-select-option value="urgent">紧急</a-select-option>
                <a-select-option value="high">高</a-select-option>
                <a-select-option value="medium">中</a-select-option>
                <a-select-option value="low">低</a-select-option>
              </a-select>
            </a-space>
          </div>

          <a-table
            :columns="taskColumns"
            :data-source="taskList"
            :pagination="taskPagination"
            :loading="taskLoading"
            row-key="_id"
            @change="handleTaskTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'priority'">
                <a-tag :color="getPriorityColor(record.priority)">
                  {{ getPriorityText(record.priority) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'elderly'">
                <div>
                  <div>{{ record.elderlyId?.name || '-' }}</div>
                  <div class="meta">
                    {{ record.elderlyId?.phone }}
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'alertLevel'">
                <a-tag v-if="record.alertId" :color="getLevelColor(record.alertId.level)">
                  {{ getLevelText(record.alertId.level) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getTaskStatusColor(record.status)">
                  {{ getTaskStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'assignedTo'">
                {{ record.assignedToName || '-' }}
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatDateTime(record.createdAt) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space>
                  <a-button type="link" @click="viewTaskDetail(record)">查看</a-button>
                  <a-button
                    type="link"
                    @click="handleProcessTask(record)"
                    v-if="record.status === 'pending' || record.status === 'in_progress'"
                  >
                    处理
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal
      v-model:open="detailModalVisible"
      title="预警详情"
      width="700px"
      :footer="null"
    >
      <div v-if="currentAlert" class="alert-detail">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="预警等级">
            <a-tag :color="getLevelColor(currentAlert.level)" style="font-weight: bold">
              {{ getLevelText(currentAlert.level) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="预警状态">
            <a-tag :color="getStatusColor(currentAlert.status)">
              {{ getStatusText(currentAlert.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="触发时间">{{ formatDateTime(currentAlert.triggeredAt) }}</a-descriptions-item>
          <a-descriptions-item label="连续未就餐">{{ currentAlert.reason?.consecutiveDays }} 天</a-descriptions-item>
          <a-descriptions-item label="就餐规律">{{ getPatternText(currentAlert.reason?.patternType) }}</a-descriptions-item>
          <a-descriptions-item label="预警阈值">{{ currentAlert.reason?.thresholdDays }} 天</a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left">老人信息</a-divider>
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="姓名">{{ currentAlert.elderlyId?.name }}</a-descriptions-item>
          <a-descriptions-item label="年龄">{{ currentAlert.elderlyId?.age }}岁</a-descriptions-item>
          <a-descriptions-item label="电话">{{ currentAlert.elderlyId?.phone }}</a-descriptions-item>
          <a-descriptions-item label="社区">{{ currentAlert.elderlyId?.community }}</a-descriptions-item>
          <a-descriptions-item label="地址" :span="2">{{ currentAlert.elderlyId?.address }}</a-descriptions-item>
          <a-descriptions-item label="紧急联系人" v-if="currentAlert.elderlyId?.emergencyContact">
            {{ currentAlert.elderlyId.emergencyContact.name }} ({{ currentAlert.elderlyId.emergencyContact.relation }})
          </a-descriptions-item>
          <a-descriptions-item label="紧急联系电话" v-if="currentAlert.elderlyId?.emergencyContact">
            {{ currentAlert.elderlyId.emergencyContact.phone }}
          </a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left">最近就餐记录</a-divider>
        <a-table
          :columns="checkInColumns"
          :data-source="lastCheckIns"
          :pagination="false"
          size="small"
          row-key="_id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'mealDate'">
              {{ formatDate(record.mealDate) }}
            </template>
            <template v-else-if="column.key === 'mealSession'">
              {{ record.mealSession === 'lunch' ? '午餐' : '晚餐' }}
            </template>
            <template v-else-if="column.key === 'canteen'">
              {{ record.canteenId?.name || '-' }}
            </template>
          </template>
        </a-table>

        <div class="detail-actions" v-if="currentAlert.status === 'pending'">
          <a-button type="primary" @click="handleDispatchTask(currentAlert)">
            派发关爱任务
          </a-button>
        </div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="taskModalVisible"
      :title="isProcessingTask ? '处理任务' : '派发任务'"
      width="500px"
      @ok="handleTaskSubmit"
      @cancel="taskModalVisible = false"
      :confirmLoading="taskSubmitting"
    >
      <a-form :model="taskForm" layout="vertical" v-if="isProcessingTask">
        <a-form-item label="处理结果">
          <a-select v-model:value="taskForm.result">
            <a-select-option value="contacted_normal">联系上，一切正常</a-select-option>
            <a-select-option value="contacted_sick">联系上，生病在家</a-select-option>
            <a-select-option value="contacted_outing">联系上，外出探亲</a-select-option>
            <a-select-option value="contacted_hospital">联系上，住院治疗</a-select-option>
            <a-select-option value="no_contact">联系不上</a-select-option>
            <a-select-option value="other">其他情况</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="联系方式">
          <a-radio-group v-model:value="taskForm.contactMethod">
            <a-radio value="phone">电话联系</a-radio>
            <a-radio value="visit">上门探访</a-radio>
            <a-radio value="neighbor">邻居转告</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="情况说明">
          <a-textarea v-model:value="taskForm.resultNote" :rows="3" placeholder="请描述具体情况" />
        </a-form-item>
        <a-form-item label="反馈备注">
          <a-textarea v-model:value="taskForm.feedback" :rows="2" placeholder="其他反馈信息" />
        </a-form-item>
        <a-form-item label="是否需要跟进">
          <a-switch v-model:checked="taskForm.followUpNeeded" />
        </a-form-item>
        <a-form-item label="跟进日期" v-if="taskForm.followUpNeeded">
          <a-date-picker v-model:value="taskForm.followUpDate" style="width: 100%" />
        </a-form-item>
      </a-form>
      <a-form :model="taskForm" layout="vertical" v-else>
        <a-form-item label="派发对象">
          <a-input v-model:value="taskForm.assignedToName" placeholder="请输入工作者姓名" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
  FileTextOutlined,
  ScanOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import {
  getAlertList,
  getAlertSummary,
  getTaskList,
  getTaskSummary,
  scanAlerts,
  assignTask,
  completeTask,
  getAlertDetail,
  type AlertItem,
  type TaskItem,
} from '@/api/care'
import { useRouter } from 'vue-router'

const router = useRouter()
const userStore = useUserStore()

const isAdmin = computed(() => userStore.userInfo?.role === 'admin')

const loading = ref(false)
const scanning = ref(false)
const taskLoading = ref(false)
const taskSubmitting = ref(false)
const activeTab = ref('alerts')

const alertSummary = reactive({
  yellow: 0,
  orange: 0,
  red: 0,
  pending: 0,
  processing: 0,
  total: 0,
})

const taskSummary = reactive({
  pending: 0,
  inProgress: 0,
  completed: 0,
  escalated: 0,
  total: 0,
  completionRate: 0,
})

const alertList = ref<AlertItem[]>([])
const taskList = ref<TaskItem[]>([])
const lastCheckIns = ref<any[]>([])

const queryForm = reactive({
  level: '',
  status: '',
})

const taskQueryForm = reactive({
  status: '',
  priority: '',
})

const alertPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const taskPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const detailModalVisible = ref(false)
const taskModalVisible = ref(false)
const isProcessingTask = ref(false)
const currentAlert = ref<AlertItem | null>(null)
const currentTask = ref<TaskItem | null>(null)

const taskForm = reactive({
  assignedTo: '',
  assignedToName: '',
  result: '' as any,
  resultNote: '',
  contactMethod: 'phone' as const,
  feedback: '',
  followUpNeeded: false,
  followUpDate: null as any,
})

const alertColumns = [
  { title: '等级', key: 'level', width: 100 },
  { title: '老人信息', key: 'elderly', width: 200 },
  { title: '原因', key: 'reason', width: 200 },
  { title: '状态', key: 'status', width: 100 },
  { title: '触发时间', key: 'triggeredAt', width: 180 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' as const },
]

const taskColumns = [
  { title: '优先级', key: 'priority', width: 90 },
  { title: '老人信息', key: 'elderly', width: 180 },
  { title: '预警等级', key: 'alertLevel', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '派发对象', key: 'assignedTo', width: 120 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' as const },
]

const checkInColumns = [
  { title: '日期', key: 'mealDate', dataIndex: 'mealDate' },
  { title: '餐段', key: 'mealSession', dataIndex: 'mealSession' },
  { title: '助餐点', key: 'canteen' },
]

function formatDateTime(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD')
}

function getLevelText(level: string) {
  const map: Record<string, string> = {
    red: '红色',
    orange: '橙色',
    yellow: '黄色',
  }
  return map[level] || level
}

function getLevelColor(level: string) {
  const map: Record<string, string> = {
    red: 'red',
    orange: 'orange',
    yellow: 'gold',
  }
  return map[level] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    resolved: '已解决',
    closed: '已关闭',
  }
  return map[status] || status
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'red',
    processing: 'orange',
    resolved: 'green',
    closed: 'default',
  }
  return map[status] || 'default'
}

function getTaskStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '待派发',
    in_progress: '处理中',
    completed: '已完成',
    escalated: '已升级',
  }
  return map[status] || status
}

function getTaskStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'orange',
    in_progress: 'blue',
    completed: 'green',
    escalated: 'red',
  }
  return map[status] || 'default'
}

function getPriorityText(priority: string) {
  const map: Record<string, string> = {
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  }
  return map[priority] || priority
}

function getPriorityColor(priority: string) {
  const map: Record<string, string> = {
    urgent: 'red',
    high: 'orange',
    medium: 'blue',
    low: 'default',
  }
  return map[priority] || 'default'
}

function getPatternText(pattern: string) {
  const map: Record<string, string> = {
    daily: '每天来',
    weekdays: '工作日来',
    frequent: '经常来',
    occasional: '偶尔来',
    rare: '很少来',
  }
  return map[pattern] || pattern
}

async function loadAlertSummary() {
  try {
    const res = await getAlertSummary()
    Object.assign(alertSummary, res)
  } catch (e) {
    console.error(e)
  }
}

async function loadTaskSummary() {
  try {
    const res = await getTaskSummary()
    Object.assign(taskSummary, res)
  } catch (e) {
    console.error(e)
  }
}

async function loadAlertList() {
  loading.value = true
  try {
    const params: any = {
      page: alertPagination.current,
      pageSize: alertPagination.pageSize,
    }
    if (queryForm.level) params.level = queryForm.level
    if (queryForm.status) params.status = queryForm.status

    const res = await getAlertList(params)
    alertList.value = res.list
    alertPagination.total = res.total
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadTaskList() {
  taskLoading.value = true
  try {
    const params: any = {
      page: taskPagination.current,
      pageSize: taskPagination.pageSize,
    }
    if (taskQueryForm.status) params.status = taskQueryForm.status
    if (taskQueryForm.priority) params.priority = taskQueryForm.priority

    const res = await getTaskList(params)
    taskList.value = res.list
    taskPagination.total = res.total
  } catch (e) {
    console.error(e)
  } finally {
    taskLoading.value = false
  }
}

function handleSearch() {
  alertPagination.current = 1
  loadAlertList()
}

function handleTaskSearch() {
  taskPagination.current = 1
  loadTaskList()
}

function handleAlertTableChange(pag: any) {
  alertPagination.current = pag.current
  alertPagination.pageSize = pag.pageSize
  loadAlertList()
}

function handleTaskTableChange(pag: any) {
  taskPagination.current = pag.current
  taskPagination.pageSize = pag.pageSize
  loadTaskList()
}

function handleTabChange(key: string) {
  if (key === 'alerts') {
    loadAlertList()
  } else if (key === 'tasks') {
    loadTaskList()
  }
}

async function viewAlertDetail(record: AlertItem) {
  try {
    const res = await getAlertDetail(record._id)
    currentAlert.value = res.alert
    lastCheckIns.value = res.lastCheckIns
    detailModalVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

function viewTaskDetail(record: TaskItem) {
  router.push(`/elderly/${record.elderlyId._id}/profile`)
}

function handleDispatchTask(record: AlertItem) {
  currentAlert.value = record
  currentTask.value = null
  isProcessingTask.value = false
  taskForm.assignedToName = ''
  taskModalVisible.value = true
}

function handleProcessTask(record: TaskItem) {
  currentTask.value = record
  isProcessingTask.value = true
  taskForm.result = ''
  taskForm.resultNote = ''
  taskForm.contactMethod = 'phone'
  taskForm.feedback = ''
  taskForm.followUpNeeded = false
  taskForm.followUpDate = null
  taskModalVisible.value = true
}

async function handleTaskSubmit() {
  if (isProcessingTask.value) {
    if (!taskForm.result) {
      message.warning('请选择处理结果')
      return
    }
    taskSubmitting.value = true
    try {
      const data: any = {
        result: taskForm.result,
        resultNote: taskForm.resultNote,
        contactMethod: taskForm.contactMethod,
        feedback: taskForm.feedback,
        followUpNeeded: taskForm.followUpNeeded,
      }
      if (taskForm.followUpDate) {
        data.followUpDate = dayjs(taskForm.followUpDate).format('YYYY-MM-DD')
      }
      await completeTask(currentTask.value!._id, data)
      message.success('任务处理完成')
      taskModalVisible.value = false
      loadTaskList()
      loadAlertList()
      loadAlertSummary()
      loadTaskSummary()
    } catch (e) {
      console.error(e)
    } finally {
      taskSubmitting.value = false
    }
  } else {
    if (!taskForm.assignedToName.trim()) {
      message.warning('请输入派发对象姓名')
      return
    }
    taskSubmitting.value = true
    try {
      if (currentAlert.value?.taskId) {
        await assignTask(
          (currentAlert.value.taskId as any)._id || currentAlert.value.taskId,
          '',
          taskForm.assignedToName,
        )
      } else {
        message.error('未找到关联任务')
        return
      }
      message.success('任务派发成功')
      taskModalVisible.value = false
      detailModalVisible.value = false
      loadAlertList()
      loadTaskList()
      loadAlertSummary()
      loadTaskSummary()
    } catch (e) {
      console.error(e)
    } finally {
      taskSubmitting.value = false
    }
  }
}

async function handleScan() {
  Modal.confirm({
    title: '确认扫描',
    content: '确定要立即执行失联预警扫描吗？',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      scanning.value = true
      try {
        const result = await scanAlerts()
        message.success(`扫描完成：新增${result.newAlerts}个预警，${result.newTasks}个任务`)
        loadAlertSummary()
        loadTaskSummary()
        loadAlertList()
      } catch (e) {
        console.error(e)
      } finally {
        scanning.value = false
      }
    },
  })
}

onMounted(() => {
  loadAlertSummary()
  loadTaskSummary()
  loadAlertList()
})
</script>

<style scoped>
.page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 8px;
  overflow: hidden;
}

.stat-card :deep(.ant-card-body) {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-content .stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.stat-content .stat-value {
  font-size: 32px;
  font-weight: bold;
}

.stat-icon {
  font-size: 48px;
  opacity: 0.3;
}

.stat-card.red .stat-content .stat-value,
.stat-card.red .stat-icon {
  color: #f5222d;
}

.stat-card.orange .stat-content .stat-value,
.stat-card.orange .stat-icon {
  color: #fa8c16;
}

.stat-card.yellow .stat-content .stat-value,
.stat-card.yellow .stat-icon {
  color: #faad14;
}

.stat-card.blue .stat-content .stat-value,
.stat-card.blue .stat-icon {
  color: #1890ff;
}

.tab-toolbar {
  margin-bottom: 16px;
}

.elderly-info .name {
  font-weight: 500;
  margin-bottom: 4px;
}

.elderly-info .meta {
  color: #999;
  font-size: 12px;
}

.meta {
  color: #999;
  font-size: 12px;
}

.detail-actions {
  margin-top: 20px;
  text-align: right;
}
</style>

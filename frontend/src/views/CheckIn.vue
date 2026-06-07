<template>
  <div class="page">
    <div class="page-header">
      <h2>就餐签到</h2>
    </div>

    <a-row :gutter="24">
      <a-col :span="10">
        <a-card title="快速签到" class="checkin-card">
          <div class="quick-checkin">
            <div class="checkin-time">
              <div class="date">{{ currentDate }}</div>
              <div class="time">{{ currentTime }}</div>
              <div class="meal-session">
                <a-tag :color="mealSession === 'lunch' ? 'blue' : 'purple'">
                  {{ mealSession === 'lunch' ? '午餐时段' : '晚餐时段' }}
                </a-tag>
              </div>
            </div>

            <div class="checkin-stats">
              <a-statistic title="今日签到" :value="todayStats.total" class="stat-item">
                <template #suffix>人次</template>
              </a-statistic>
              <a-statistic title="午餐" :value="todayStats.lunchCount" class="stat-item lunch">
                <template #suffix>人次</template>
              </a-statistic>
              <a-statistic title="晚餐" :value="todayStats.dinnerCount" class="stat-item dinner">
                <template #suffix>人次</template>
              </a-statistic>
            </div>

            <a-divider />

            <a-form :model="quickForm" layout="vertical">
              <a-form-item label="助餐点">
                <a-select v-model:value="quickForm.canteenId" placeholder="请选择助餐点">
                  <a-select-option v-for="c in canteenList" :key="c._id" :value="c._id">
                    {{ c.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="签到方式">
                <a-radio-group v-model:value="quickForm.method">
                  <a-radio-button value="card">刷卡</a-radio-button>
                  <a-radio-button value="face">人脸</a-radio-button>
                  <a-radio-button value="staff">代签</a-radio-button>
                  <a-radio-button value="phone">手机</a-radio-button>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="老人信息">
                <a-input-search
                  v-model:value="quickForm.keyword"
                  placeholder="输入姓名/身份证号/手机号搜索"
                  size="large"
                  enter-button="签到"
                  loading="checking"
                  @search="handleQuickCheckIn"
                />
              </a-form-item>
            </a-form>

            <div class="recent-list">
              <div class="recent-title">最近签到</div>
              <a-list size="small" :data-source="recentCheckIns" :locale="{ emptyText: '暂无签到记录' }">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <a-list-item-meta
                      :title="item.elderlyId?.name || '-'"
                      :description="`${item.mealSession === 'lunch' ? '午餐' : '晚餐'} · ${formatTime(item.checkInTime)}`"
                    />
                    <a-tag :color="getMethodColor(item.method)">{{ getMethodText(item.method) }}</a-tag>
                  </a-list-item>
                </template>
              </a-list>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :span="14">
        <a-card title="签到记录">
          <a-form :model="queryForm" layout="inline" class="query-form">
            <a-form-item label="助餐点">
              <a-select
                v-model:value="queryForm.canteenId"
                placeholder="全部助餐点"
                style="width: 160px"
                allow-clear
                @change="handleSearch"
              >
                <a-select-option v-for="c in canteenList" :key="c._id" :value="c._id">
                  {{ c.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="日期">
              <a-range-picker
                v-model:value="dateRange"
                style="width: 240px"
                @change="handleDateChange"
              />
            </a-form-item>
            <a-form-item label="签到方式">
              <a-select
                v-model:value="queryForm.method"
                placeholder="全部方式"
                style="width: 120px"
                allow-clear
                @change="handleSearch"
              >
                <a-select-option value="card">刷卡</a-select-option>
                <a-select-option value="face">人脸</a-select-option>
                <a-select-option value="staff">代签</a-select-option>
                <a-select-option value="phone">手机</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button @click="handleReset">重置</a-button>
            </a-form-item>
          </a-form>

          <a-table
            :columns="columns"
            :data-source="dataSource"
            :pagination="pagination"
            :loading="loading"
            row-key="_id"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'elderly'">
                <div>
                  <div>{{ record.elderlyId?.name || '-' }}</div>
                  <div style="color: #999; font-size: 12px">
                    {{ record.elderlyId?.age }}岁
                    <span v-if="record.elderlyId?.isAlone" style="color: #faad14">· 独居</span>
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'canteen'">
                {{ record.canteenId?.name || '-' }}
              </template>
              <template v-else-if="column.key === 'meal'">
                <div>
                  <div>{{ record.mealSession === 'lunch' ? '午餐' : '晚餐' }}</div>
                  <div style="color: #999; font-size: 12px">{{ formatDate(record.mealDate) }}</div>
                </div>
              </template>
              <template v-else-if="column.key === 'method'">
                <a-tag :color="getMethodColor(record.method)">
                  {{ getMethodText(record.method) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'checkInTime'">
                {{ formatTime(record.checkInTime) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import {
  getCheckInList,
  getTodayCheckInStats,
  quickCheckIn,
  type CheckInItem,
  type TodayCheckInStats,
} from '@/api/checkin'
import { getCanteenList } from '@/api/canteens'

const userStore = useUserStore()

const loading = ref(false)
const checking = ref(false)
const dataSource = ref<CheckInItem[]>([])
const recentCheckIns = ref<CheckInItem[]>([])
const canteenList = ref<any[]>([])
const todayStats = reactive<TodayCheckInStats>({
  date: '',
  lunchCount: 0,
  dinnerCount: 0,
  total: 0,
})

const currentTime = ref('')
let timer: number | null = null

const currentDate = computed(() => dayjs().format('YYYY年MM月DD日 dddd'))

const mealSession = computed(() => {
  const hour = dayjs().hour()
  return hour >= 17 ? 'dinner' : 'lunch'
})

const queryForm = reactive({
  canteenId: '',
  method: '',
  startDate: '',
  endDate: '',
})

const quickForm = reactive({
  keyword: '',
  canteenId: '',
  method: 'staff' as const,
})

const dateRange = ref<any[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
})

const columns = [
  { title: '老人信息', key: 'elderly', width: 180 },
  { title: '助餐点', key: 'canteen', width: 150 },
  { title: '餐段', key: 'meal', width: 140 },
  { title: '签到方式', key: 'method', width: 100 },
  { title: '签到时间', key: 'checkInTime', width: 180 },
]

function updateTime() {
  currentTime.value = dayjs().format('HH:mm:ss')
}

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD')
}

function formatTime(time: string) {
  return dayjs(time).format('HH:mm:ss')
}

function getMethodText(method: string) {
  const map: Record<string, string> = {
    card: '刷卡',
    face: '人脸',
    staff: '代签',
    phone: '手机',
  }
  return map[method] || method
}

function getMethodColor(method: string) {
  const map: Record<string, string> = {
    card: 'blue',
    face: 'green',
    staff: 'orange',
    phone: 'purple',
  }
  return map[method] || 'default'
}

async function loadCanteens() {
  try {
    const res = await getCanteenList({ pageSize: 100 })
    canteenList.value = res.list
    if (res.list.length > 0) {
      if (userStore.userInfo?.role === 'canteen' && userStore.userInfo?.canteenId) {
        quickForm.canteenId = userStore.userInfo.canteenId
        queryForm.canteenId = userStore.userInfo.canteenId
      } else {
        quickForm.canteenId = res.list[0]._id
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function loadTodayStats() {
  try {
    const res = await getTodayCheckInStats()
    Object.assign(todayStats, res)
  } catch (e) {
    console.error(e)
  }
}

async function loadCheckInList() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    if (queryForm.canteenId) params.canteenId = queryForm.canteenId
    if (queryForm.method) params.method = queryForm.method
    if (queryForm.startDate) params.startDate = queryForm.startDate
    if (queryForm.endDate) params.endDate = queryForm.endDate

    const res = await getCheckInList(params)
    dataSource.value = res.list
    pagination.total = res.total
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadRecentCheckIns() {
  try {
    const params: any = {
      page: 1,
      pageSize: 5,
    }
    if (quickForm.canteenId) params.canteenId = quickForm.canteenId

    const res = await getCheckInList(params)
    recentCheckIns.value = res.list
  } catch (e) {
    console.error(e)
  }
}

async function handleQuickCheckIn() {
  if (!quickForm.keyword.trim()) {
    message.warning('请输入老人信息')
    return
  }
  if (!quickForm.canteenId) {
    message.warning('请选择助餐点')
    return
  }

  checking.value = true
  try {
    await quickCheckIn({
      keyword: quickForm.keyword,
      canteenId: quickForm.canteenId,
      method: quickForm.method,
    })
    message.success('签到成功')
    quickForm.keyword = ''
    loadTodayStats()
    loadCheckInList()
    loadRecentCheckIns()
  } catch (e) {
    console.error(e)
  } finally {
    checking.value = false
  }
}

function handleSearch() {
  pagination.current = 1
  loadCheckInList()
}

function handleDateChange(dates: any) {
  if (dates && dates.length === 2) {
    queryForm.startDate = dayjs(dates[0]).format('YYYY-MM-DD')
    queryForm.endDate = dayjs(dates[1]).format('YYYY-MM-DD')
  } else {
    queryForm.startDate = ''
    queryForm.endDate = ''
  }
  handleSearch()
}

function handleReset() {
  queryForm.canteenId = userStore.userInfo?.role === 'canteen' ? userStore.userInfo?.canteenId || '' : ''
  queryForm.method = ''
  dateRange.value = []
  queryForm.startDate = ''
  queryForm.endDate = ''
  pagination.current = 1
  loadCheckInList()
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadCheckInList()
}

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
  loadCanteens().then(() => {
    loadTodayStats()
    loadCheckInList()
    loadRecentCheckIns()
  })
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
.page {
  padding: 24px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.checkin-card {
  position: sticky;
  top: 0;
}

.quick-checkin {
  text-align: center;
}

.checkin-time {
  margin-bottom: 24px;
}

.checkin-time .date {
  font-size: 16px;
  color: #666;
  margin-bottom: 8px;
}

.checkin-time .time {
  font-size: 48px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 12px;
  font-family: 'Courier New', monospace;
}

.meal-session {
  margin-top: 12px;
}

.checkin-stats {
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
  padding: 16px 0;
  background: #f5f5f5;
  border-radius: 8px;
}

.stat-item {
  text-align: center;
}

.stat-item.lunch :deep(.ant-statistic-content) {
  color: #1890ff;
}

.stat-item.dinner :deep(.ant-statistic-content) {
  color: #722ed1;
}

.query-form {
  margin-bottom: 16px;
}

.recent-list {
  margin-top: 24px;
  text-align: left;
}

.recent-title {
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
}
</style>

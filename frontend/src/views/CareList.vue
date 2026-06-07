<template>
  <div class="page">
    <div class="page-header">
      <h2>关怀名单</h2>
    </div>

    <a-row :gutter="24">
      <a-col :span="16">
        <a-card title="生日关怀">
          <div class="card-toolbar">
            <a-radio-group v-model:value="birthdayDays" @change="handleDaysChange">
              <a-radio-button value="7">未来7天</a-radio-button>
              <a-radio-button value="15">未来15天</a-radio-button>
              <a-radio-button value="30">未来30天</a-radio-button>
            </a-radio-group>
            <span class="count-text">共 {{ birthdayList.length }} 位老人</span>
          </div>

          <a-spin :spinning="birthdayLoading">
            <a-table
              :columns="birthdayColumns"
              :data-source="birthdayList"
              :pagination="false"
              row-key="id"
              size="middle"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <div class="elderly-name">
                    <a-avatar size="small" style="background-color: #1890ff; margin-right: 8px">
                      {{ record.name?.charAt(0) }}
                    </a-avatar>
                    <span>{{ record.name }}</span>
                    <a-tag v-if="record.isAlone" color="orange" style="margin-left: 8px">独居</a-tag>
                  </div>
                </template>
                <template v-else-if="column.key === 'age'">
                  {{ record.age }}岁
                </template>
                <template v-else-if="column.key === 'birthday'">
                  {{ formatBirthday(record.birthday) }}
                </template>
                <template v-else-if="column.key === 'daysUntil'">
                  <a-tag :color="record.daysUntil <= 3 ? 'red' : record.daysUntil <= 7 ? 'orange' : 'blue'">
                    {{ record.daysUntil === 0 ? '今天生日' : `还有 ${record.daysUntil} 天` }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'phone'">
                  {{ record.phone }}
                </template>
                <template v-else-if="column.key === 'community'">
                  {{ record.community }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space>
                    <a-button type="link" size="small" @click="viewProfile(record.id)">查看</a-button>
                    <a-button type="link" size="small">
                      <PhoneOutlined /> 致电
                    </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>

            <div v-if="birthdayList.length === 0 && !birthdayLoading" class="empty-state">
              <a-empty description="暂无生日关怀名单" />
            </div>
          </a-spin>
        </a-card>
      </a-col>

      <a-col :span="8">
        <a-card title="节日关怀">
          <div class="holiday-list">
            <div
              v-for="holiday in holidayList"
              :key="holiday.name"
              class="holiday-item"
            >
              <div class="holiday-icon">
                <GiftOutlined />
              </div>
              <div class="holiday-info">
                <div class="holiday-name">{{ holiday.name }}</div>
                <div class="holiday-date">{{ formatDate(holiday.date) }}</div>
              </div>
              <div class="holiday-countdown">
                <a-tag v-if="holiday.daysUntil <= 7" color="red">
                  {{ holiday.daysUntil === 0 ? '今天' : `${holiday.daysUntil}天后` }}
                </a-tag>
                <a-tag v-else color="default">{{ holiday.daysUntil }}天后</a-tag>
              </div>
            </div>
          </div>

          <a-divider />

          <div class="care-tips">
            <h4>温馨提示</h4>
            <ul>
              <li>生日老人当天可享免费餐</li>
              <li>重大节日为所有老人加餐</li>
              <li>独居老人需额外关注</li>
              <li>高龄老人建议上门慰问</li>
            </ul>
          </div>
        </a-card>

        <a-card title="关怀统计" style="margin-top: 16px">
          <a-row :gutter="16">
            <a-col :span="12">
              <div class="mini-stat">
                <div class="mini-stat-value">{{ birthdayList.length }}</div>
                <div class="mini-stat-label">近期生日</div>
              </div>
            </a-col>
            <a-col :span="12">
              <div class="mini-stat">
                <div class="mini-stat-value">{{ holidayList.length }}</div>
                <div class="mini-stat-label">即将到来节日</div>
              </div>
            </a-col>
          </a-row>
          <a-divider style="margin: 12px 0" />
          <div class="total-elderly">
            覆盖老人: <b>{{ totalElderly }}</b> 人
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PhoneOutlined, GiftOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import {
  getBirthdayList,
  getHolidays,
  type BirthdayItem,
  type HolidayItem,
} from '@/api/care'

const router = useRouter()

const birthdayLoading = ref(false)
const birthdayDays = ref('7')
const birthdayList = ref<BirthdayItem[]>([])
const holidayList = ref<HolidayItem[]>([])
const totalElderly = ref(0)

const birthdayColumns = [
  { title: '姓名', key: 'name', width: 180 },
  { title: '年龄', key: 'age', width: 80 },
  { title: '生日', key: 'birthday', width: 120 },
  { title: '倒计时', key: 'daysUntil', width: 120 },
  { title: '电话', key: 'phone', width: 130 },
  { title: '社区', key: 'community', width: 120 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' as const },
]

function formatBirthday(date: string) {
  return dayjs(date).format('MM月DD日')
}

function formatDate(date: string) {
  return dayjs(date).format('YYYY年MM月DD日')
}

function handleDaysChange(e: any) {
  loadBirthdayList(parseInt(e.target.value, 10))
}

async function loadBirthdayList(days: number = 7) {
  birthdayLoading.value = true
  try {
    const res = await getBirthdayList(days)
    birthdayList.value = res.list
  } catch (e) {
    console.error(e)
  } finally {
    birthdayLoading.value = false
  }
}

async function loadHolidays() {
  try {
    const res = await getHolidays()
    holidayList.value = res.upcoming
    totalElderly.value = res.totalElderly
  } catch (e) {
    console.error(e)
  }
}

function viewProfile(id: string) {
  router.push(`/elderly/${id}/profile`)
}

onMounted(() => {
  loadBirthdayList(7)
  loadHolidays()
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

.card-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.count-text {
  color: #999;
  font-size: 13px;
}

.elderly-name {
  display: flex;
  align-items: center;
}

.holiday-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.holiday-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.holiday-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #ff9c6e, #ff7a45);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

.holiday-info {
  flex: 1;
}

.holiday-name {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 2px;
}

.holiday-date {
  font-size: 12px;
  color: #999;
}

.holiday-countdown {
  flex-shrink: 0;
}

.care-tips h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
}

.care-tips ul {
  margin: 0;
  padding-left: 20px;
  color: #666;
  font-size: 13px;
  line-height: 2;
}

.mini-stat {
  text-align: center;
  padding: 8px 0;
}

.mini-stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.mini-stat-label {
  font-size: 12px;
  color: #999;
}

.total-elderly {
  text-align: center;
  color: #666;
  font-size: 13px;
}

.total-elderly b {
  color: #1890ff;
  font-size: 16px;
}

.empty-state {
  padding: 40px 0;
}
</style>

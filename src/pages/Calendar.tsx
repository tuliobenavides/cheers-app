import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  getYear,
  setYear
} from 'date-fns'

interface BirthdayEvent {
  id: string
  full_name: string
  avatar_url: string | null
  birthday: string
  actualDate: Date // The birthday date for the current year
}

export const Calendar = () => {
  const { profile } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [birthdays, setBirthdays] = useState<BirthdayEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      fetchBirthdays()
    }
  }, [profile, currentDate])

  const fetchBirthdays = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Fetch friends' birthdays
      const { data: friends, error } = await supabase
        .from('friendships')
        .select(`
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, birthday),
          addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, birthday)
        `)
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      if (error) throw error

      // Process birthdays for the current month/year view
      const currentYear = getYear(currentDate)
      const processedBirthdays: BirthdayEvent[] = []

      friends?.forEach((friendship: any) => {
        const isRequester = friendship.requester_id === profile.id
        const friend = isRequester ? friendship.addressee : friendship.requester

        if (friend?.birthday) {
          const originalBirthday = parseISO(friend.birthday)
          const birthdayThisYear = setYear(originalBirthday, currentYear)

          processedBirthdays.push({
            id: friend.id,
            full_name: friend.full_name || 'Unknown',
            avatar_url: friend.avatar_url,
            birthday: friend.birthday,
            actualDate: birthdayThisYear
          })
        }
      })

      setBirthdays(processedBirthdays)
    } catch (error) {
      console.error('Error fetching birthdays:', error)
    } finally {
      setLoading(false)
    }
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  })

  const getBirthdaysForDay = (day: Date) => {
    return birthdays.filter(birthday => 
      isSameDay(birthday.actualDate, day)
    )
  }

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToToday = () => setCurrentDate(new Date())

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse text-lg">Loading calendar...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <CalendarIcon className="h-10 w-10" />
          Birthday Calendar
        </h1>
        <p className="text-muted-foreground text-lg">
          Keep track of all your friends' birthdays
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-semibold">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Header Days */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDays.map((day, index) => {
              const dayBirthdays = getBirthdaysForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isToday = isSameDay(day, new Date())
              
              return (
                <div
                  key={index}
                  className={`
                    min-h-[100px] p-2 border rounded-lg transition-colors
                    ${isCurrentMonth ? 'bg-background' : 'bg-muted/50 text-muted-foreground'}
                    ${isToday ? 'ring-2 ring-primary' : ''}
                    ${dayBirthdays.length > 0 ? 'bg-primary/5 border-primary/20' : ''}
                  `}
                >
                  <div className="text-sm font-medium mb-2">
                    {format(day, 'd')}
                  </div>
                  
                  {dayBirthdays.length > 0 && (
                    <div className="space-y-1">
                      {dayBirthdays.slice(0, 2).map((birthday) => (
                        <div 
                          key={birthday.id}
                          className="flex items-center space-x-1 text-xs bg-primary/10 rounded p-1"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={birthday.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {birthday.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">🎂 {birthday.full_name}</span>
                        </div>
                      ))}
                      {dayBirthdays.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayBirthdays.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Birthdays This Month */}
      <Card>
        <CardHeader>
          <CardTitle>Birthdays This Month</CardTitle>
          <CardDescription>
            {format(currentDate, 'MMMM yyyy')} celebrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const monthBirthdays = birthdays
              .filter(birthday => isSameMonth(birthday.actualDate, currentDate))
              .sort((a, b) => a.actualDate.getDate() - b.actualDate.getDate())

            if (monthBirthdays.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No birthdays this month</p>
                  <p className="text-sm">Check other months to see upcoming celebrations!</p>
                </div>
              )
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthBirthdays.map((birthday) => {
                  const isPast = birthday.actualDate < new Date()
                  const isToday = isSameDay(birthday.actualDate, new Date())
                  
                  return (
                    <Card key={birthday.id} className={isToday ? 'ring-2 ring-primary' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={birthday.avatar_url || undefined} />
                            <AvatarFallback>
                              {birthday.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{birthday.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(birthday.actualDate, 'MMMM d, yyyy')}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              {isToday && <Badge variant="destructive">Today! 🎉</Badge>}
                              {isPast && !isToday && <Badge variant="outline">Past</Badge>}
                              {!isPast && !isToday && <Badge variant="secondary">Upcoming</Badge>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, FlatList, Alert, TouchableOpacity, StyleSheet, BackHandler, AppState, SafeAreaView} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Notifee, { EventType, TimestampTrigger, TriggerType } from '@notifee/react-native';
import { format, isAfter, differenceInDays } from 'date-fns';


// Task type
type Task = {
  id: number;
  name: string;
  description: string;
  deadlineDate: Date;
  safeDate: Date;
  completed: boolean; // New field
  completionDate?: Date;
};
// Helper function to calculate remaining days
const getRemainingDays = (deadline: Date) => {
  const currentDate = new Date();
  return Math.ceil(differenceInDays(deadline, currentDate));
};

// Notification-related functions
const scheduleNotifications = async (task: Task) => {
  // Define the three daily notification times
  const scheduleTimes = [
    { hour: 8, minutes: 0 },
    { hour: 12, minutes: 0 },
    { hour: 18, minutes: 0 },
  ];

  const currentDate = new Date();
  const daysLeft = getRemainingDays(task.deadlineDate);

  // Only schedule notifications if the task is not completed and not past the deadline
  if (daysLeft > 0) {
    // Schedule notifications for each time of the day
    for (const time of scheduleTimes) {
      const notificationDate = new Date();
      notificationDate.setHours(time.hour, time.minutes, 0, 0);

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: notificationDate.getTime(),
      };

      await Notifee.createTriggerNotification(
        {
          title: 'Task Reminder',
          body: `Task "${task.name}" is due in ${daysLeft} day(s). Keep working toward the deadline!`,
          android: {
            channelId: 'default',
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        },
        trigger
      );
    }
  }

  // Schedule notification for the task's specific safe date
  const safeTrigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: task.safeDate.getTime(),
  };

  await Notifee.createTriggerNotification(
    {
      title: 'Task Reminder',
      body: `Task "${task.name}" is due today. Please complete it!`,
      android: {
        channelId: 'default',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    },
    safeTrigger
  );

  // Schedule notification for the task's specific deadline date
  const deadlineTrigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: task.deadlineDate.getTime(),
  };

  await Notifee.createTriggerNotification(
    {
      title: 'Task Deadline Reminder',
      body: `Task "${task.name}" is due soon. ${daysLeft} days left until the deadline.`,
      android: {
        channelId: 'default',
        pressAction: { id: 'default', launchActivity: 'default' },
      }
    },
    deadlineTrigger
  );
};

const setupNotificationListeners = () => {
  // Listen for app state changes
  AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      // Handle active notifications (foreground)
      const unsubscribe = Notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.DISMISSED) {
          console.log('Notification dismissed:', detail.notification?.title);
        } else if (type === EventType.PRESS) {
          console.log('Notification pressed:', detail.notification?.title);
        }
      });
      
      return unsubscribe; // Clean up listener when app is active
    }
  });

  // Listen for background/killed notifications
  Notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      console.log('Notification pressed in background/killed:', detail.notification?.title);
      // Additional handling logic, if needed, for pressed background notifications
    }
  });
};
// TaskListScreen Component
const TaskListScreen = ({ navigate, tasks, deleteTask, markAsCompleted }: { navigate: (screen: string) => void; tasks: Task[]; deleteTask: (id: number) => void; markAsCompleted: (id: number) => void }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.head}>
      <TouchableOpacity style={[styles.button, styles.statsbutton]} onPress={() => navigate('Stats')}>
       <Text style={styles.statsbuttonText}>Stats</Text>
      </TouchableOpacity>
        <Text style={styles.header}>Task List</Text>
        <TouchableOpacity style={[styles.completescreenButton, styles.button]} onPress={() => navigate('CompletedTasks')}>
          <Text style={styles.buttonText}>View Completed Tasks</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <Text style={styles.taskName}>{item.name}</Text>
            <Text style={styles.taskDescription}>{item.description}</Text>
            <Text style={styles.taskDates}>Deadline: {format(item.deadlineDate, 'MMM d, yyyy')}</Text>
            <Text style={styles.taskDates}>Safe Date: {format(item.safeDate, 'MMM d, yyyy')}</Text>
            <View style={styles.taskActions}>
              <TouchableOpacity style={[styles.button, styles.editButton]} onPress={() => navigate('EditTask', item)}>
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={() => deleteTask(item.id)}>
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.completeButton]} onPress={() => markAsCompleted(item.id)}>
                <Text style={styles.buttonText}>Complete</Text>
              </TouchableOpacity>

            </View>
          </View>
        )}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => navigate('AddTask')}>
        <Text style={styles.buttonText}>Add Task</Text>
      </TouchableOpacity>
      <View style={styles.footer}>
        <Text style={styles.footertext}>Copyright Eshean Oliver 2024</Text>
      </View>
      </SafeAreaView>
  );
};

// AddTaskScreen Component
const AddTaskScreen = ({ navigate, addTask, initialValues }: { navigate: (screen: string) => void; addTask: (task: Task) => void; initialValues?: Task }) => {
  const [name, setName] = useState(initialValues ? initialValues.name : '');
  const [description, setDescription] = useState(initialValues ? initialValues.description : '');
  const [deadlineDate, setDeadlineDate] = useState(initialValues ? new Date(initialValues.deadlineDate) : new Date());
  const [safeDate, setSafeDate] = useState(initialValues ? new Date(initialValues.safeDate) : new Date());
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showSafePicker, setShowSafePicker] = useState(false);

  const handleAddTask = () => {
    if (!name || !description) {
      Alert.alert('All fields are required!');
      return;
    }
  
    const newTask: Task = {
      id: initialValues ? initialValues.id : new Date().getTime(), // Use existing ID if editing
      name,
      description,
      deadlineDate,
      safeDate,
    };

    addTask(newTask);
    scheduleNotifications(newTask); // Schedule notifications for the new task
    navigate('TaskList');
  };  
  
  return (
    <View>
      <Text style={styles.headertext}>Add New Task</Text>
      <TextInput placeholder="Task Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={styles.input} />

      <TouchableOpacity onPress={() => setShowDeadlinePicker(true)} style={styles.deadlinedate}>
        <Text style={styles.datetext}>Select Deadline Date: {format(deadlineDate, 'MMM d, yyyy')}</Text>
      </TouchableOpacity>
      {showDeadlinePicker && (
        <DateTimePicker value={deadlineDate} mode="date" display="default" onChange={(event, date) => { setShowDeadlinePicker(false); setDeadlineDate(date || deadlineDate); }} />
      )}

<TouchableOpacity onPress={() => setShowSafePicker(true)} style={styles.safedate}>
        <Text style={styles.datetext}>Select Safe Date: {format(safeDate, 'MMM d, yyyy')}</Text>
      </TouchableOpacity>
      {showSafePicker && (
        <DateTimePicker value={safeDate} mode="date" display="default" onChange={(event, date) => { setShowSafePicker(false); setSafeDate(date || safeDate); }} />
      )}

      <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
        <Text style={styles.buttonText}>Add Task</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.goBackButton} onPress={() => navigate('TaskList')}>
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

// StatsScreen Component
const StatsScreen: React.FC<{
  tasks: Task[];
  navigate: (screen: string) => void;
}> = ({ tasks, navigate }) => {
  const getTaskStats = () => {
    const completedTasks = tasks.filter(task => task.completed);
    const totalTasks = tasks.length;
    const completedCount = completedTasks.length;
    const completionRate = totalTasks ? (completedCount / totalTasks) * 100 : 0;

    let beforeSafeDate = 0;
    let onSafeDate = 0;
    let onDeadline = 0;
    let afterDeadline = 0;
    let stillIncompleteAfterDeadline = 0;

    const currentDate = new Date();

    completedTasks.forEach(task => {
      if (task.completionDate) {
        if (task.completionDate < task.safeDate) {
          beforeSafeDate++;
        } else if (differenceInDays(task.completionDate, task.safeDate) === 0) {
          onSafeDate++;
        } else if (differenceInDays(task.completionDate, task.deadlineDate) === 0) {
          onDeadline++;
        } else if (isAfter(task.completionDate, task.deadlineDate)) {
          afterDeadline++;
        }
      }
    });

    tasks.forEach(task => {
      if (!task.completed && isAfter(currentDate, task.deadlineDate)) {
        stillIncompleteAfterDeadline++;
      }
    });

    return {
      totalTasks,
      completedCount,
      completionRate,
      beforeSafeDate,
      onSafeDate,
      onDeadline,
      afterDeadline,
      stillIncompleteAfterDeadline,
    };
  };

  const stats = getTaskStats(); // Store the stats in a variable

  return (
    <View style={styles.statsContainer}>
      <Text style={styles.statsheader}>STATISTICS</Text>
      <View style={styles.stats}>
        <Text style={styles.statsText}>Total Tasks: {stats.totalTasks}</Text>
        <Text style={styles.statsText}>Completed Tasks: {stats.completedCount}</Text>
        <Text style={styles.statsText}>Completion Rate: {stats.completionRate.toFixed(2)}%</Text>
        <Text style={styles.statsText}>Completed Before Safe Date: {stats.beforeSafeDate}</Text>
        <Text style={styles.statsText}>Completed On Safe Date: {stats.onSafeDate}</Text>
        <Text style={styles.statsText}>Completed On Deadline: {stats.onDeadline}</Text>
        <Text style={styles.statsText}>Completed After Deadline: {stats.afterDeadline}</Text>
        <Text style={styles.statsText}>Still Incomplete After Deadline: {stats.stillIncompleteAfterDeadline}</Text>
      </View>
      <TouchableOpacity style={styles.goBackButton} onPress={() => navigate('TaskList')}>
        <Text style={styles.buttonText}>Back to Task List</Text>
      </TouchableOpacity>
    </View>
  );
};

// completed task screen
const CompletedTasksScreen: React.FC<{
  navigate: (screen: Screen) => void;
  tasks: Task[];
  restoreTask: (id: number) => void;
}> = ({ navigate, tasks, restoreTask }) => (
  <SafeAreaView style={styles.container}>
    <Text style={styles.header}>Completed Tasks</Text>
    <FlatList
      data={tasks.filter(task => task.completed)}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.taskItem}>
          <Text style={styles.taskName}>{item.name}</Text>
          <Text style={styles.taskDescription}>{item.description}</Text>
          {item.completionDate ? (
            <Text style={styles.taskDates}>
            Completed on: {format(item.completionDate, 'MMM d, yyyy')}
          </Text>
          ) : (
            <Text style={styles.taskDates}>Completed (date unknown)</Text>
          )}
          <TouchableOpacity style={styles.restoreButton} onPress={() => restoreTask(item.id)}>
            <Text style={styles.buttonText}>Restore</Text>
          </TouchableOpacity>
        </View>
      )}
    />
    <TouchableOpacity style={styles.goBackButton} onPress={() => navigate('TaskList')}>
      <Text style={styles.buttonText}>Back to Task List</Text>
    </TouchableOpacity>
    <View style={styles.footer}>
      <Text style={styles.footertext}>Copyright Eshean Oliver 2024</Text>
    </View>
  </SafeAreaView>
);

// Main App Component with AsyncStorage
const App = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentScreen, setCurrentScreen] = useState<string>('TaskList');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  //notification
  const setupNotificationChannel = async () => {
    await Notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: 4, // 4 corresponds to HIGH importance
    });
  };
  //mark as complete
  const markAsCompleted = async (id: number) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id
        ? { ...task, completed: true, completionDate: new Date() }
        : task
    );
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };
//restore task
const restoreTask = async (id: number) => {
  const updatedTasks = tasks.map((task) =>
      task.id === id 
          ? { ...task, completed: false, completionDate: undefined } 
          : task
  );
  setTasks(updatedTasks);
  await saveTasks(updatedTasks); // Save the updated tasks immediately
};
  
useEffect(() => {
  const initializeNotifications = async () => {
    // Setup notification channel
    try {
      await Notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: 4, // High importance
      });
      console.log('Notification channel created');

      // Request notification permission
      const settings = await Notifee.requestPermission();
      if (settings.authorizationStatus === 1) {
        console.log('Notification permission granted');
      } else {
        console.log('Notification permission not granted');
        Alert.alert('Notification permission not granted!');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
    // Load tasks
    loadTasks();
  };

  initializeNotifications();

  // Setup back handler
  const backAction = () => {
    if (currentScreen === 'TaskList') {
      return false;
    } else {
      navigate('TaskList');
      return true;
    }
  };

  const backHandler = BackHandler.addEventListener(
    'hardwareBackPress',
    backAction
  );

  // Cleanup
  return () => backHandler.remove();
}, []); 

const loadTasks = async () => {
  try {
    const storedTasks = await AsyncStorage.getItem('tasks');
    if (storedTasks) {
      const parsedTasks = JSON.parse(storedTasks).map((task: any) => ({
        ...task,
        deadlineDate: new Date(task.deadlineDate),
        safeDate: new Date(task.safeDate),
        completionDate: task.completionDate ? new Date(task.completionDate) : undefined
      }));
      setTasks(parsedTasks);
    } else {
      setTasks([]);
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    Alert.alert('Error', 'Failed to load tasks');
    setTasks([]);
  }
};

  const saveTasks = async (tasksToSave: Task[]) => {
    try {
        await AsyncStorage.setItem('tasks', JSON.stringify(tasksToSave));
    } catch (error) {
        console.error('Error saving tasks:', error);
        Alert.alert('Error', 'Failed to save tasks');
    }
};

const addTask = (task: Task) => {
  task.completed = false;
  const newTasks = [...tasks, task];
  setTasks(newTasks);
  saveTasks(newTasks);
  scheduleNotifications(task); // Schedule notifications for the new task
};

  const editTask = (updatedTask: Task) => {
    const newTasks = tasks.map((task) => 
      (task.id === updatedTask.id ? { ...updatedTask, completed: task.completed } : task)
    );
    setTasks(newTasks);
    saveTasks(newTasks);
    scheduleNotifications(updatedTask); 
  }; 
  const deleteTask = (taskId: number) => {
    const newTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const navigate = (screen: string, params?: any) => {
    setSelectedTask(params);
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
        case 'TaskList':
            return (
                <TaskListScreen
                    navigate={navigate}
                    tasks={tasks.filter((task) => !task.completed)}
                    deleteTask={(id) => {
                        const updatedTasks = tasks.filter((task) => task.id !== id);
                        setTasks(updatedTasks);
                        saveTasks(updatedTasks);
                    }}
                    markAsCompleted={markAsCompleted}
                />
            );
        case 'CompletedTasks':
            return <CompletedTasksScreen navigate={navigate} tasks={tasks} restoreTask={restoreTask} />;
        case 'AddTask':
            return <AddTaskScreen navigate={navigate} addTask={addTask} />;
        case 'EditTask':
            return selectedTask ? (
                <AddTaskScreen
                    navigate={navigate}
                    addTask={editTask}
                    initialValues={selectedTask}
                />
            ) : (
                <TaskListScreen navigate={navigate} tasks={tasks} deleteTask={deleteTask} />
            );
        case 'Stats':
            return <StatsScreen navigate={navigate} tasks={tasks} />;
        default:
            return <TaskListScreen navigate={navigate} tasks={tasks} deleteTask={deleteTask} />;
    }
};

  return <View style={styles.container}>{renderScreen()}</View>;
};

// Styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    backgroundColor: '#24293E',
    position: 'relative', 
  },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  completescreenButton: {
    backgroundColor: 'purple',
  },
  statsbutton:{
    backgroundColor: 'white',
  },
  statsbuttonText:{
    color: 'black',
    fontWeight: 'bold',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingBottom: 20,
    marginBottom: 15,
    textAlign: 'center',
    paddingTop: 20,
    marginTop: 20,
    backgroundColor: '#24293E',
    color: 'white',
  },
  datetext: {
    color: 'black',
    fontSize: 13,
    paddingHorizontal: 5,
    fontWeight: 'bold',
  },
  taskItem: {
    padding: 15,
    backgroundColor: '#8EBBFF',
    borderRadius: 10,
    marginBottom: 10,
    marginHorizontal: 15,
  },
  headertext: {
  textAlign: 'center',
  color: 'white',
  margin: 15,
  fontSize: 25,
  },
  taskName: {
    fontSize: 25,
    fontWeight: 'bold',
    color: 'white',
  },
  taskDescription: {
    fontSize: 18,
    marginVertical: 5,
    color: 'white',
  },
  taskDates: {
    fontSize: 18,
    color: 'black',
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    width: '30%',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: 'green',
  },
  deleteButton: {
    backgroundColor: '#FF4500',
  },
  addButton: {
    backgroundColor: '#008CBA',
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 60,
  },
  completeButton: {
    backgroundColor: 'purple',
  },
  goBackButton: {
    backgroundColor: 'red',
    marginTop: 10,
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 60,
  },
  deadlinedate: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 10,
    borderWidth: 3,
    borderColor: 'cyan',
  },
  safedate: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 10,
    borderWidth: 3,
    borderColor: 'cyan',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    height: 60,
    marginHorizontal: 20,
    borderColor: 'white',
    color: 'white',
    backgroundColor: 'grey',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
  },
  stats: {
    alignItems: 'center',
  },
  statsheader: {
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 30,
    color: 'white',
    backgroundColor: 'purple',
    marginBottom: 20,
  },
  statsText:{
    textAlign: 'center',
    borderColor: 'black',
    borderWidth: 1,
    color: 'red',
    backgroundColor: 'white',
    marginVertical: 5,
    height: '8%',
    textAlignVertical: 'center',
    width: '80%',
    borderRadius: 10,
    fontSize: 20,
  },
  restoreButton: {
    backgroundColor: 'green',
    marginTop: 10,
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 20,
  },
  exportButton: {
    backgroundColor: '#008CBA',
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderColor: 'white',
    borderWidth: 5,
    padding: 10,
    backgroundColor: 'white',
    // Add these additional properties:
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  footertext: {
    color: 'red',
    fontWeight: 'bold',
    textAlign: 'center',
  }
});

export default App;

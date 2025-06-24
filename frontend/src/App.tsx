import { useState } from 'react'
import './App.css'
import { Chat } from './components/chat'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <Chat />
       </div>
    </>
  )
}

export default App

// src/context/PlantContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { plants } from '../api'
import { useAuth } from './AuthContext'

const PlantContext = createContext(null)

export function PlantProvider({ children }) {
  const { user } = useAuth()
  const [plantList, setPlantList] = useState([])
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    plants.list()
      .then(({ data }) => {
        const list = data.data.plants || []
        setPlantList(list)
        // Auto-select first plant or restore from localStorage
        const saved = localStorage.getItem('selectedPlantId')
        const found = list.find(p => p.id === saved) || list[0]
        if (found) setSelectedPlant(found)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  // Apply plant colour theme to <body>
  useEffect(() => {
    const theme = selectedPlant?.short_name?.startsWith('TAQA') ? 'TAQA'
                : selectedPlant?.short_name === 'TTPP'          ? 'TTPP'
                : selectedPlant?.short_name === 'ANPARA'        ? 'ANPARA'
                : ''
    document.body.setAttribute('data-plant', theme)
  }, [selectedPlant])

  const switchPlant = (plant) => {
    setSelectedPlant(plant)
    localStorage.setItem('selectedPlantId', plant.id)
  }

  return (
    <PlantContext.Provider value={{ plantList, selectedPlant, switchPlant, loading }}>
      {children}
    </PlantContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePlant = () => useContext(PlantContext)
